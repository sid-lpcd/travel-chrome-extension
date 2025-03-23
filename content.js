chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  if (request.method === "getText") {
    console.log("Replying");
    const innerTextRaw = document.body.innerText;
    let cleanedText = innerTextRaw.trim();
    cleanedText = cleanedText.replace(/\s+/g, " ");

    cleanedText = cleanedText.replace(/[\r\n]+/g, " "); // Remove newlines and carriage returns
    cleanedText = cleanedText.replace(/[^a-zA-Z0-9.,?! ]/g, ""); // Remove special characters (customize as needed)

    const words = cleanedText.split(" ");
    const locationText = words.slice(0, 100).join(" ");

    sendResponse({ data: cleanedText, locationText, method: "getText" });
  }
});
