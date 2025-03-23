chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  if (request.method === "getText") {
    console.log("Replying");
    let cleanedText = "";
    const articles = document.querySelectorAll("article");
    if (articles.length > 0) {
      // Merge text from all article elements
      cleanedText = Array.from(articles)
        .map((article) => article.innerText)
        .join(" ");
    } else {
      // If no articles, check for <main>
      const mainContent = document.querySelector("main");
      if (mainContent) {
        cleanedText = mainContent.innerText;
      } else {
        // If neither articles nor main exist, use body
        cleanedText = document.body.innerText;
      }
    }

    cleanedText = cleanedText.trim().replace(/\s+/g, " ");
    cleanedText = cleanedText.replace(/[\r\n]+/g, " "); // Remove newlines and carriage returns
    cleanedText = cleanedText.replace(/[^a-zA-Z0-9.,?! ]/g, ""); // Remove special characters (customize as needed)

    const words = cleanedText.split(" ");
    const locationText = words.slice(0, 100).join(" ");

    sendResponse({ data: cleanedText, locationText, method: "getText" });
  }
});
