declare const Zotero: any
declare const IOUtils: any
/*
declare const Components: any
const {
  classes: Cc,
  interfaces: Ci,
  utils: Cu,
} = Components
*/

Zotero.KnowledgeCenterPlugin = new class {
  log(msg) {
    Zotero.debug(`Knowledge Center Plugin: ${  msg}`)
  }

  foo() {
    // Global properties are included automatically in Zotero 7
    const host = new URL('https://foo.com/path').host
    this.log(`Host is ${host}`)
    this.log(`Intensity is ${Zotero.Prefs.get('extensions.zotero-test.intensity', true)}`)

    const parser = new DOMParser()
    const doc = parser.parseFromString('<foo><bar/></foo>', 'text/xml')
    this.log(doc.documentElement.outerHTML)
  }

  async fail(errorMessage: string) {
    const l10n = this.getL10n()
    const progressWindow = new Zotero.ProgressWindow()
    // 获取本地化的同步标题
    const syncTitle = await l10n.formatValue('kcenter-title')
    // 设置进度窗口的标题
    progressWindow.changeHeadline(syncTitle)
    const itemProgress = new progressWindow.ItemProgress()
    progressWindow.show()
    itemProgress.setError()
    itemProgress.setText(errorMessage)
    progressWindow.addDescription('')
    // The window will be closed by a timer at the end of the sync process.
    progressWindow.startCloseTimer()
  }

  async success(message: string) {
    const l10n = this.getL10n()
    const progressWindow = new Zotero.ProgressWindow()
    // 获取本地化的同步标题
    const syncTitle = await l10n.formatValue('kcenter-title')
    // 设置进度窗口的标题
    progressWindow.changeHeadline(syncTitle)
    const itemProgress = new progressWindow.ItemProgress()
    progressWindow.show()
    itemProgress.setText(message)
    progressWindow.addDescription('')
    // The window will be closed by a timer at the end of the sync process.
    progressWindow.startCloseTimer()
  }

  getL10n() {
    // Fluent localization object is on the main window's document
    return Zotero.getMainWindow().document.l10n
  }

  async itemSyncKcenter(tagId?: number): Promise<void> {
    this.log(`Starting sync with parameter: ${tagId || 'not specified'}`)

    // 从 Zotero 主窗口获取 FormData 和 Blob 构造函数，用于创建表单数据
    const { FormData, Blob } = Zotero.getMainWindow()
    // 获取本地化（多语言）对象
    const l10n = this.getL10n()

    // 从 Zotero 首选项中获取 API Key 和基础 URL
    const apiKey = Zotero.Prefs.get('extensions.zotero-knowledge-center-plugin.apikey', true) || ''
    const baseUrl = Zotero.Prefs.get('extensions.zotero-knowledge-center-plugin.baseurl', true) || ''
    // 检查 API Key 是否已配置
    if (!apiKey || apiKey === '') {
      const msg = await l10n.formatValue('kcenter-sync-error-apikey-missing')
      await this.fail(msg)
      return
    }

    // 检查基础 URL 是否已配置
    if (!baseUrl || baseUrl === '') {
      const msg = await l10n.formatValue('kcenter-sync-error-baseurl-missing')
      await this.fail(msg)
      return
    }
    this.log(`Using Base URL: ${baseUrl}`)

    // 获取当前 Zotero 窗格中选中的条目
    const items = Zotero.getActiveZoteroPane()?.getSelectedItems(false)
    this.log(JSON.stringify(items))
    // 检查是否选中了任何条目
    if (!items || items.length === 0) {
      this.log('No items selected.')
      const msg = await l10n.formatValue('kcenter-no-items-to-sync')
      await this.fail(msg)
      return
    }
    // 遍历所有选中的条目
    for (const item of items) {
      const displayTitle = item.getDisplayTitle()
      const extraField = item.getField('extra') || ''
      // 检查条目是否已经同步过 (通过 Extra 字段)
      if (extraField.includes('KCenter-Synced: true')) {
        this.log(`Skipping already synced item: "${displayTitle}"`)
        continue
      }

      // 检查条目类型是否为“期刊文章”，如果不是则报错并停止
      if (item.itemType !== 'journalArticle') {
        const msg = await l10n.formatValue('kcenter-sync-item-type-error')
        await this.fail(msg)
        continue
      }
      this.log(`Processing item: "${displayTitle}" (ID: ${item.id})`)

      // 为上传准备 FormData
      const formData = new FormData()
      // 将条目的元数据（JSON格式）添加到表单中
      formData.append('item_metadata', JSON.stringify(item.toJSON()))
      // 获取条目的所有附件ID
      const attachmentIDs = item.getAttachments()

      if (attachmentIDs.length > 0) {
        // 异步获取所有附件的完整对象
        const attachments = await Zotero.Items.getAsync(attachmentIDs)

        // 遍历所有附件
        for (const attachment of attachments) {
          // 获取附件的文件名和内容类型
          const filename = attachment.attachmentFilename
          const contentType = attachment.attachmentContentType
          // 将附件的元数据（JSON格式）添加到表单中
          formData.append('attachment_metadata', JSON.stringify(attachment.toJSON()))

          // 检查附件是否为 PDF 文件
          if (attachment.isAttachment() && contentType === 'application/pdf') {
            const filePath = attachment.getFilePath() // 获取文件的绝对路径
            if (filePath) {
              try {
                // 异步读取文件内容（二进制格式）
                const fileContentBytes = await IOUtils.read(filePath)
                // 创建一个 Blob 对象并将其添加到表单中，准备上传
                const fileBlob = new Blob([fileContentBytes], { type: 'application/pdf' })
                formData.append('file', fileBlob, filename)
                break
              }
              catch (e) {
                this.log(`    Error processing file ${filename}: ${e}`)
              }
            }
          }
          else {
            // 如果不是 PDF 文件，则跳过
            this.log(`  - Skipping non-PDF attachment: "${filename}" (Type: ${contentType})`)
          }
        }
      }

      try {
        // 将数据上传到服务器
        // 构造完整的上传 URL
        const uploadURL = `${baseUrl.replace(/\/$/, '')}/open_yit_ai/user/knowledgeCenter/zotero/sync?tagId=${tagId}`

        const response = await fetch(uploadURL, {
          method: 'POST',
          headers: {
            'yit-kcenter-key': `${apiKey}`,
            // 使用 FormData 时，'Content-Type' 会由浏览器自动设置
          },
          body: formData,
        })

        if (response.ok) {
          // 如果成功，更新进度条为成功消息
          const msg = await l10n.formatValue('kcenter-sync-success')
          const successMessage = `${displayTitle} ${msg} `
          await this.success(successMessage)
          // 在 Extra 字段中添加同步标记
          const newExtra = extraField ? `${extraField}\nKCenter-Synced: true` : 'KCenter-Synced: true'
          item.setField('extra', newExtra)
          // 异步保存对条目的修改
          await item.saveTx()
        }
        else {
          // 如果失败，记录错误并显示失败信息
          const errorText = await response.text()
          this.log(`Failed to upload ${displayTitle}. Status: ${response.status}. Response: ${errorText}`)
          const msg = await l10n.formatValue('kcenter-sync-error')
          await this.fail(msg)
        }
      }
      catch (e) {
        // 捕获并记录网络请求或其他意外错误
        this.log(`An unexpected error occurred during sync: ${e}`)
        const msg = await l10n.formatValue('kcenter-sync-error-message')
        await this.fail(msg)
      }
    }
  }

  async getTags(): Promise<any[]> {
    // 从 Zotero 首选项中获取 API Key 和基础 URL
    const apiKey = Zotero.Prefs.get('extensions.zotero-knowledge-center-plugin.apikey', true) || null
    const baseUrl = Zotero.Prefs.get('extensions.zotero-knowledge-center-plugin.baseurl', true) || null

    if (!apiKey || !baseUrl) {
      return []
    }
    const url = `${baseUrl.replace(/\/$/, '')}/open_yit_ai/user/knowledgeCenter/zotero/tags`
    const response = await fetch(url, {
      headers: {
        'yit-kcenter-key': `${apiKey}`,
        'Content-Type': 'application/json',
      },
    })
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`)
    }
    const data = await response.json()
    return data['data']
  }
}
