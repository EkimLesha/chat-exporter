document.getElementById('exportBtn').addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  // Загружаем turndown.js
  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ['turndown.js']
  });

  // Выполняем основной скрипт
  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => {
      // Инициализируем Turndown с настройками для Markdown
      const turndownService = new TurndownService({
        headingStyle: 'atx',
        hr: '---',
        bulletListMarker: '-',
        codeBlockStyle: 'fenced',
        fence: '```',
        emDelimiter: '_',
        strongDelimiter: '**',
        linkStyle: 'inlined',
        linkReferenceStyle: 'full',
        br: '\n\n'
      });

      // Кастомные правила для DeepSeek Chat
      
      // 1. Обработка блоков кода
      turndownService.addRule('deepseekCodeBlock', {
        filter: node => {
          return node.classList?.contains('ds-code-block') || 
                 node.querySelector('.ds-code-block')
        },
        replacement: (content, node) => {
          // Получаем язык программирования
          const codeBlock = node.querySelector('.ds-code-block') || node;
          const language = Array.from(codeBlock.classList)
            .find(c => c.startsWith('language-'))?.replace('language-', '') || '';
          
          // Очищаем от кнопок и лишнего текста
          const codeContent = codeBlock.textContent
            .replace(/\b(Copy|Download|python|javascript)\b/gi, '')
            .replace(/^\n+|\n+$/g, '');
          
          return `\`\`\`${language}\n${codeContent}\n\`\`\`\n\n`;
        }
      });

      // 2. Обработка инлайн-кода
      turndownService.addRule('deepseekInlineCode', {
        filter: node => node.classList?.contains('ds-inline-code'),
        replacement: content => `\`${content.replace(/`/g, '\\`').trim()}\``
      });

      // 3. Обработка сообщений пользователя
      turndownService.addRule('userMessages', {
        filter: node => node.classList?.contains('fbb737a4'),
        replacement: content => `> ${content.trim()}\n\n`
      });

      // 4. Обработка сообщений бота
      turndownService.addRule('botMessages', {
        filter: node => node.classList?.contains('ds-markdown'),
        replacement: (content, node) => {
          // Сохраняем форматирование, но чистим лишние элементы
          const cleanHtml = node.innerHTML
            .replace(/<button[^>]*>.*?<\/button>/g, '') // Удаляем кнопки
            .replace(/<span class="[^"]*copy-text[^"]*">.*?<\/span>/g, '');
          
          return turndownService.turndown(cleanHtml) + '\n\n---\n';
        }
      });

      // 5. Удаляем ненужные элементы интерфейса
      turndownService.remove('.msg-actions'); // Кнопки "Копировать" и т.д.
      turndownService.remove('.timestamp');   // Временные метки

      // Собираем все сообщения
      const chatContainer = document.querySelector('.chat-container') || document.body;
      const markdown = turndownService.turndown(chatContainer);

      // Пост-обработка
      return markdown
        .replace(/\n{3,}/g, '\n\n')  // Удаляем лишние переносы
        .replace(/```\s*\n/g, '```\n') // Чистим блоки кода
        .trim();
    }
  }, (results) => {
    const markdown = results[0]?.result || "Не удалось экспортировать переписку";
    
    // Пытаемся скопировать в буфер обмена
    navigator.clipboard.writeText(markdown)
      .then(() => alert("Переписка скопирована в Markdown!"))
      .catch(() => {
        // Fallback: скачиваем как файл
        const blob = new Blob([markdown], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `deepseek-chat-${new Date().toISOString().slice(0,10)}.md`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      });
  });
});