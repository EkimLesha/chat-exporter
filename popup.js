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
        br: '\n', // Важно: сохраняем переносы строк
        blankReplacement: (content, node) => {
          return node.isBlock ? '\n\n' : ''; // Двойной перенос для абзацев
        }
      });

      // Кастомные правила для DeepSeek Chat
      turndownService.addRule('preserveParagraphs', {
        filter: 'p',
        replacement: (content) => `${content}\n\n` // Двойной перенос после абзацев
      });

      turndownService.addRule('preserveLineBreaks', {
        filter: 'br',
        replacement: () => '\n' // Одинарный перенос для <br>
      });

      // Сбор сообщений с сохранением структуры
      const userMessages = Array.from(document.querySelectorAll('div.fbb737a4'))
        .map(el => `> ${el.textContent.trim()}`)
        .filter(Boolean);

      const botMessages = Array.from(document.querySelectorAll('div.ds-markdown'))
        .map(el => {
          // Добавляем временные маркеры для абзацев
          el.querySelectorAll('p').forEach(p => {
            p.innerHTML = p.innerHTML.replace(/\n/g, '␤') // Сохраняем переносы
          });
          let md = turndownService.turndown(el.innerHTML);
          md = md.replace(/␤/g, '\n'); // Восстанавливаем переносы
          return md;
        })
        .filter(Boolean);

      // Формируем переписку с правильными отступами
      let markdownOutput = [];
      const maxLength = Math.max(userMessages.length, botMessages.length);
      
      for (let i = 0; i < maxLength; i++) {
        if (userMessages[i]) {
          markdownOutput.push(`${userMessages[i]}\n\n`);
        }
        if (botMessages[i]) {
          markdownOutput.push(`${botMessages[i]}\n\n---\n`);
        }
      }

      return markdownOutput.join('\n');
    }
  }, (results) => {
    const markdown = results[0]?.result || "Ошибка экспорта";
    navigator.clipboard.writeText(markdown)
      .then(() => alert("Готово! Переписка с сохранёнными абзацами скопирована."))
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
