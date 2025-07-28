/* eslint-disable prefer-arrow/prefer-arrow-functions, no-var, @typescript-eslint/no-unused-vars, no-caller, @typescript-eslint/explicit-module-boundary-types */

declare const Zotero: any
declare const Services: any

var stylesheetID = 'zotero-knowledge-center-plugin-stylesheet'
var ftlID = 'zotero-knowledge-center-plugin-ftl'
var menuitemID = 'make-it-green-instead'
var toolbarbuttonID = 'knowledge-center-toolbar-button'
var rightMenuID = 'knowledge-center-item-menu'
var collectionMenuID = 'knowledge-center-collection-menu'
var addedElementIDs = [stylesheetID, ftlID, menuitemID, toolbarbuttonID, rightMenuID, collectionMenuID]

function log(msg) {
  Zotero.debug(`Knowledge Center Plugin: ${  msg}`)
}

export function install() {
  log('Installed')
}

export async function startup({ id, version, rootURI }) {
  log('插件启动中...')

  // 注册插件的设置面板
  const paneID = await Zotero.PreferencePanes.register({
    pluginID: 'knowledge-center-plugin@youngerinfo.com', // 插件的唯一ID
    src: `${rootURI}preferences.xhtml`, // 设置面板界面的 xhtml 文件路径
    label: 'Kcenter', // 在 Zotero 设置中显示的标签
    image: `${rootURI}icon.png`, // 设置面板的图标
  })

  // 获取当前活动的 Zotero 窗格
  var zp = Zotero.getActiveZoteroPane()
  if (zp) {
    const doc = zp.document

    // 链接本地化资源文件 (.ftl)，用于界面多语言支持
    const link2 = doc.createElement('link')
    link2.id = ftlID
    link2.rel = 'localization'
    link2.href = 'zotero-knowledge-center-plugin.ftl'
    doc.documentElement.appendChild(link2)

    // 在“工具”菜单下添加一个菜单项，用于打开插件设置
    const button = doc.createXULElement('menuitem')
    button.id = toolbarbuttonID
    button.setAttribute('data-l10n-id', 'kcenter-preferences') // 使用本地化ID来显示文本
    button.setAttribute('image', `${rootURI}icon.png`)
    button.addEventListener('command', () => {
      // 点击时打开上面注册的设置面板
      Zotero.Utilities.Internal.openPreferences(paneID)
    })
    doc.getElementById('menu_ToolsPopup').appendChild(button)

    // 在条目列表的右键菜单中添加一个菜单项
    const rightMenu = doc.createXULElement('menuitem')
    rightMenu.id = rightMenuID
    rightMenu.setAttribute('data-l10n-id', 'kcenter-sync-title') // 使用本地化ID
    rightMenu.setAttribute('image', `${rootURI}icon.png`)
    rightMenu.addEventListener('command', async () => {
      // 点击时执行同步功能
      await Zotero.KnowledgeCenterPlugin.itemSyncKcenter()
    })
    doc.getElementById('zotero-itemmenu').appendChild(rightMenu)
  }
  // 加载插件的核心逻辑文件 lib.js
  Services.scriptloader.loadSubScript(`${rootURI  }lib.js`)
  Zotero.KnowledgeCenterPlugin.foo()
}

export function shutdown() {
  log('Shutting down')

  // Remove added UI elements
  var zp = Zotero.getActiveZoteroPane()
  if (zp) {
    for (const id of addedElementIDs) {
      zp.document.getElementById(id)?.remove()
    }
  }

  Zotero.KnowledgeCenterPlugin = undefined
}

export function uninstall() {
  log('Uninstalled')
}
