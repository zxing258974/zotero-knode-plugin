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
  // 加载插件的核心逻辑文件 lib.js
  Services.scriptloader.loadSubScript(`${rootURI  }lib.js`)
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

    // 创建一个顶级菜单，它将作为二级菜单的父级
    const menu = doc.createXULElement('menu')
    menu.id = rightMenuID
    menu.setAttribute('data-l10n-id', 'kcenter-sync-title') // 一级菜单的标签，例如 "知识中心"
    menu.setAttribute('image', `${rootURI}icon.png`)

    // 创建一个弹出菜单作为二级菜单的容器
    const menupopup = doc.createXULElement('menupopup')

    // 定义二级菜单项，并从服务器获取标签列表进行合并
    let menuItems = [{ id: -1, tagName: '默认文献夹' }]
    try {
      const tags = await Zotero.KnowledgeCenterPlugin.getTags()
      Zotero.KnowledgeCenterPlugin.log(`tags - ${JSON.stringify(tags)}`)
      // 确保返回的是一个数组才进行合并
      if (Array.isArray(tags)) {
        menuItems = menuItems.concat(tags)
      }
    }
    catch (e) {
      log(`Could not fetch tags for menu: ${e}`)
    }

    Zotero.KnowledgeCenterPlugin.log(menuItems)
    // 循环创建二级菜单项
    for (const item of menuItems) {
      const menuItem = doc.createXULElement('menuitem')
      menuItem.id = `${rightMenuID}-${item.id}`
      menuItem.setAttribute('label', item.tagName)
      // 使用闭包来捕获每个菜单项特定的参数
      menuItem.addEventListener('command', async () => {
        await Zotero.KnowledgeCenterPlugin.itemSyncKcenter(item.id)
      })
      menupopup.appendChild(menuItem)
    }
    menu.appendChild(menupopup)
    // 将整个二级菜单结构添加到条目右键菜单中
    doc.getElementById('zotero-itemmenu').appendChild(menu)
  }
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
