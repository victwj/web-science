/**
 * Content script for extracting url, title, and content from page using Readability script
 * @module WebScience.Measurements.content-scripts.metadata
 */
// Function encapsulation to maintain unique variable scope for each content script
(
  async function () {
    /**
     * Helper function to send metadata to background script
     * @param {string} type - message type
     * @param {Object} article - object containing metadata extracted from parsing
     * @returns {void} Nothing
     */
    function sendPageMetadataToBackground(type, article) {
        browser.runtime.sendMessage({
            type: type,
            url : document.location.href,
            title : article.title,
            content : article.textContent
        });
    }

    // clone for document for parsing using Readability script
    let documentClone = document.cloneNode(true);
    let article = new Readability(documentClone).parse();
    sendPageMetadataToBackground(name, article);
  }
)();
