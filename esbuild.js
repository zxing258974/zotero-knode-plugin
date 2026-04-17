const path = require('path')
const fs = require('fs')
const esbuild = require('esbuild')
const rmrf = require('rimraf')
rmrf.sync('build')
rmrf.sync('gen')

require('zotero-plugin/copy-assets')
require('zotero-plugin/make-manifest')

function xmlEscape(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function generateLegacyMetadata() {
  const pkg = require('./package.json')
  const supported = JSON.parse(fs.readFileSync(path.join(__dirname, 'schema', 'supported.json'), 'utf8'))
  const { version } = require('./gen/version.cjs')

  const installRdf = `<?xml version="1.0" encoding="utf-8" ?>
<RDF xmlns="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns:em="http://www.mozilla.org/2004/em-rdf#">
  <Description about="urn:mozilla:install-manifest">
    <em:name>${xmlEscape(pkg.xpi.name)}</em:name>
    <em:description>${xmlEscape(pkg.description)}</em:description>
    <em:bootstrap>true</em:bootstrap>
    <em:id>${xmlEscape(pkg.id)}</em:id>
    <em:version>${xmlEscape(version)}</em:version>
    <em:homepageURL>${xmlEscape(pkg.homepage)}</em:homepageURL>
    <em:creator>${xmlEscape(pkg.author.name)}</em:creator>
    <em:updateURL>${xmlEscape(`${pkg.xpi.releaseURL}update.rdf`)}</em:updateURL>
    <em:type>2</em:type>
    <em:targetApplication>
      <Description>
        <em:id>zotero@chnm.gmu.edu</em:id>
        <em:minVersion>${xmlEscape(supported.minVersion)}</em:minVersion>
        <em:maxVersion>${xmlEscape(supported.maxVersion)}</em:maxVersion>
      </Description>
      <Description>
        <em:id>juris-m@juris-m.github.io</em:id>
        <em:minVersion>${xmlEscape(supported.minVersion)}</em:minVersion>
        <em:maxVersion>${xmlEscape(supported.maxVersion)}</em:maxVersion>
      </Description>
    </em:targetApplication>
  </Description>
</RDF>
`

  const updateRdf = `<?xml version="1.0" encoding="utf-8" ?>
<RDF:RDF xmlns:RDF="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns:em="http://www.mozilla.org/2004/em-rdf#">
  <RDF:Description about="urn:mozilla:extension:${xmlEscape(pkg.id)}">
    <em:updates>
      <RDF:Seq>
        <RDF:li>
          <RDF:Description>
            <em:version>${xmlEscape(version)}</em:version>
            <em:targetApplication>
              <RDF:Description>
                <em:id>zotero@chnm.gmu.edu</em:id>
                <em:minVersion>${xmlEscape(supported.minVersion)}</em:minVersion>
                <em:maxVersion>${xmlEscape(supported.maxVersion)}</em:maxVersion>
                <em:updateLink>${xmlEscape(pkg.xpi.updateLink.replace('{version}', version))}</em:updateLink>
              </RDF:Description>
            </em:targetApplication>
            <em:targetApplication>
              <RDF:Description>
                <em:id>juris-m@juris-m.github.io</em:id>
                <em:minVersion>${xmlEscape(supported.minVersion)}</em:minVersion>
                <em:maxVersion>${xmlEscape(supported.maxVersion)}</em:maxVersion>
                <em:updateLink>${xmlEscape(pkg.xpi.updateLink.replace('{version}', version))}</em:updateLink>
              </RDF:Description>
            </em:targetApplication>
          </RDF:Description>
        </RDF:li>
      </RDF:Seq>
    </em:updates>
  </RDF:Description>
</RDF:RDF>
`

  fs.writeFileSync(path.join(__dirname, 'build', 'install.rdf'), installRdf, 'utf8')
  fs.writeFileSync(path.join(__dirname, 'gen', 'update.rdf'), updateRdf, 'utf8')
}

function js(src) {
  return src.replace(/[.]ts$/, '.js')
}

async function bundle(config) {
  config = {
    bundle: true,
    format: 'iife',
    target: ['firefox60'],
    inject: [],
    treeShaking: true,
    keepNames: true,
    ...config,
  }

  let target
  if (config.outfile) {
    target = config.outfile
  }
  else if (config.entryPoints.length === 1 && config.outdir) {
    target = path.join(config.outdir, js(path.basename(config.entryPoints[0])))
  }
  else {
    target = `${config.outdir} [${config.entryPoints.map(js).join(', ')}]`
  }

  const exportGlobals = config.exportGlobals
  delete config.exportGlobals
  if (exportGlobals) {
    const esm = await esbuild.build({ ...config, logLevel: 'silent', format: 'esm', metafile: true, write: false })
    if (Object.values(esm.metafile.outputs).length !== 1) throw new Error('exportGlobals not supported for multiple outputs')

    for (const output of Object.values(esm.metafile.outputs)) {
      if (output.entryPoint) {
        config.globalName = escape(`{ ${output.exports.sort().join(', ')} }`).replace(/%/g, '$')
        // make these var, not const, so they get hoisted and are available in the global scope.
      }
    }
  }

  console.log('* bundling', target)
  await esbuild.build(config)
  if (exportGlobals) {
    await fs.promises.writeFile(
      target,
      (await fs.promises.readFile(target, 'utf-8')).replace(config.globalName, unescape(config.globalName.replace(/[$]/g, '%')))
    )
  }
}

async function build() {
  generateLegacyMetadata()

  await bundle({
    exportGlobals: true,
    entryPoints: [ 'bootstrap.ts' ],
    outdir: 'build',
    banner: { js: 'var Zotero;\n' },
  })

  await bundle({
    entryPoints: [ 'lib.ts' ],
    outdir: 'build',
    banner: { js: 'var Zotero;\nif (!Zotero.KnowledgeCenterPlugin) {\n' },
    footer: { js: '\n}' },
  })
}

build().catch(err => {
  console.log(err)
  process.exit(1)
})
