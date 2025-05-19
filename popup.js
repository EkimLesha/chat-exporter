document.getElementById('exportBtn').addEventListener('click', async () => {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    // Подключаем turndown.js к странице
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['turndown.js']
    });

    // Запускаем скрипт, который собирает и конвертирует переписку
    const [result] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        const turndownService = new TurndownService();

        const userMessages = Array.from(document.querySelectorAll('div.fbb737a4'))
          .map(el => el.textContent.trim())
          .filter(text => text.length > 0);

        const botMessages = Array.from(document.querySelectorAll('div.ds-markdown'))
          .map(el => el.innerHTML.trim())
          .filter(html => html.length > 0)
          .map(html => turndownService.turndown(html));

        let markdownOutput = [];
        const maxLength = Math.max(userMessages.length, botMessages.length);

        for (let i = 0; i < maxLength; i++) {
          if (userMessages[i]) {
            markdownOutput.push(`> ${userMessages[i]}\n\n`);
          }
          if (botMessages[i]) {
            markdownOutput.push(`${botMessages[i]}\n\n---\n`);
          }
        }

        return markdownOutput.join('\n');
      }
    });

    const markdown = result.result || "Не удалось собрать переписку";

    await navigator.clipboard.writeText(markdown);
    alert("Переписка скопирована в Markdown!");

  } catch (e) {
    alert("Ошибка: " + e.message);
    console.error(e);
  }
});
