document.getElementById('exportBtn').addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ['turndown.js']
  });

  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => {
      const turndownService = new TurndownService({
        headingStyle: 'atx',
        hr: '---',
        bulletListMarker: '-',
        codeBlockStyle: 'fenced',
        br: '\n\n'
      });

      // Явные правила для таблиц
      turndownService.addRule('tables', {
        filter: 'table',
        replacement: (content, node) => {
          const rows = node.querySelectorAll('tr');
          let mdTable = '';
          
          rows.forEach((row, i) => {
            const cells = Array.from(row.querySelectorAll('td, th'))
              .map(cell => cell.textContent.trim())
              .join(' | ');
            
            mdTable += `${cells}\n`;
            
            // Добавляем строку разделителя после заголовка
            if (i === 0) {
              const alignRow = Array.from(row.querySelectorAll('td, th'))
                .map(() => '---')
                .join(' | ');
              mdTable += `${alignRow}\n`;
            }
          });
          
          return mdTable;
        }
      });

      // Улучшенная обработка блоков кода
      turndownService.addRule('codeBlocks', {
        filter: ['pre', 'code'],
        replacement: (content, node) => {
          if (node.tagName === 'PRE') {
            const language = node.querySelector('code')?.classList?.value?.match(/language-(\w+)/)?.[1] || '';
            return `\`\`\`${language}\n${node.textContent}\n\`\`\`\n\n`;
          }
          return `\`${node.textContent}\``;
        }
      });

      // Сохранение абзацев и переносов (как в вашем коде)
      turndownService.addRule('preserveParagraphs', {
        filter: 'p',
        replacement: (content) => `${content}\n\n`
      });

      turndownService.addRule('preserveLineBreaks', {
        filter: 'br',
        replacement: () => '\n'
      });

      // Сбор сообщений
      const userMessages = Array.from(document.querySelectorAll('div.fbb737a4'))
        .map(el => `> ${el.textContent.trim()}`)
        .filter(Boolean);

      const botMessages = Array.from(document.querySelectorAll('div.ds-markdown'))
        .map(el => {
          // Временные маркеры для переносов
          el.querySelectorAll('p').forEach(p => {
            p.innerHTML = p.innerHTML.replace(/\n/g, '␤');
          });
          
          let md = turndownService.turndown(el.innerHTML)
            .replace(/␤/g, '\n')
            .replace(/\n{3,}/g, '\n\n'); // Убираем лишние переносы
          
          return md;
        })
        .filter(Boolean);

      // Формирование итогового Markdown
      let markdownOutput = [];
      const maxLength = Math.max(userMessages.length, botMessages.length);
      
      for (let i = 0; i < maxLength; i++) {
        if (userMessages[i]) markdownOutput.push(`${userMessages[i]}\n\n`);
        if (botMessages[i]) markdownOutput.push(`${botMessages[i]}\n\n---\n`);
      }

      return markdownOutput.join('\n');
    }
  }, (results) => {
    const markdown = results[0]?.result || "Ошибка экспорта";
    navigator.clipboard.writeText(markdown)
      .then(() => alert("Готово! Таблицы и код теперь сохраняются правильно."))
      .catch(() => {
        const blob = new Blob([markdown], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `chat-export-${new Date().getTime()}.md`;
        a.click();
      });
  });
});