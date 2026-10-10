/**
 * MathsManthra AI Assistant - Floating Chatbot Client
 * Connects to the local MathsManthra AI Assistant API (http://localhost:4000/api/chat)
 */

(function () {
  "use strict";

  // API endpoint configuration
  const API_ENDPOINT = (window.MM_CONFIG && window.MM_CONFIG.AI_API_URL)
    ? window.MM_CONFIG.AI_API_URL
    : "https://mathsmanthralandingpage-production.up.railway.app/api/chat";

  // Founder avatar URL
  const AVATAR_URL = "./mathsmanthra-ai-assistant/public/images/smija/idle.png";

  // State
  let isChatOpen = false;
  let isLoading = false;

  /**
   * Smija avatar state manager
   * Updates document.getElementById("smijaAvatar") based on state
   * Supported states: idle, thinking, answer, error
   * @param {string} state
   */
  function setSmijaState(state) {
    const SMIJA_STATES = {
      idle: "./mathsmanthra-ai-assistant/public/images/smija/idle.png",
      thinking: "./mathsmanthra-ai-assistant/public/images/smija/thinking.png",
      answer: "./mathsmanthra-ai-assistant/public/images/smija/answer.png",
      error: "./mathsmanthra-ai-assistant/public/images/smija/error.png"
    };

    const avatar = document.getElementById("smijaAvatar");
    if (!avatar) {
      console.warn("Element with id 'smijaAvatar' not found.");
      return;
    }

    if (SMIJA_STATES[state]) {
      avatar.src = SMIJA_STATES[state];
    } else {
      console.warn(`Unsupported state: "${state}". Supported states: idle, thinking, answer, error.`);
    }
  }

  // Expose globally
  window.setSmijaState = setSmijaState;

  // DOM Elements
  let launcherBtn = null;
  let chatPanel = null;
  let closeBtn = null;
  let messagesContainer = null;
  let chatForm = null;
  let chatInput = null;
  let sendBtn = null;

  /**
   * Initialize chatbot elements and bind event handlers
   */
  function initChatbot() {
    launcherBtn = document.getElementById("mm-chat-launcher");
    chatPanel = document.getElementById("mm-chat-panel");
    closeBtn = document.getElementById("mm-chat-close-btn");
    messagesContainer = document.getElementById("mm-chat-messages");
    chatForm = document.getElementById("mm-chat-form");
    chatInput = document.getElementById("mm-chat-input");
    sendBtn = document.getElementById("mm-chat-send-btn");

    if (!launcherBtn || !chatPanel) {
      console.warn("MathsManthra AI Chatbot elements not found.");
      return;
    }

    // Toggle panel on launcher click
    launcherBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      toggleChat(!isChatOpen);
    });

    // Close on close button click
    if (closeBtn) {
      closeBtn.addEventListener("click", function (e) {
        e.stopPropagation();
        toggleChat(false);
      });
    }

    // Close on ESC key
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && isChatOpen) {
        toggleChat(false);
      }
    });

    // Close when clicking outside on mobile or desktop
    document.addEventListener("click", function (e) {
      if (isChatOpen && !chatPanel.contains(e.target) && !launcherBtn.contains(e.target)) {
        toggleChat(false);
      }
    });

    // Form submit / Enter key handler
    if (chatForm) {
      chatForm.addEventListener("submit", function (e) {
        e.preventDefault();
        handleFormSubmit();
      });
    }

    // Quick suggestion prompt chips
    if (messagesContainer) {
      messagesContainer.addEventListener("click", function (e) {
        const promptBtn = e.target.closest(".mm-quick-prompt");
        if (promptBtn) {
          if (promptBtn.hasAttribute("data-mm-consult") || promptBtn.textContent.includes("Consultation")) {
            if (typeof window.openSheet === "function") {
              window.openSheet("mm-consult-sheet");
            } else {
              const el = document.getElementById("mm-consult-sheet");
              const bd = document.getElementById("mm-backdrop");
              if (el) {
                el.classList.remove("translate-y-full", "pointer-events-none", "opacity-0");
                el.classList.add("translate-y-0");
              }
              if (bd) bd.classList.remove("hidden");
            }
            return;
          }
          const promptText = promptBtn.textContent.trim();
          if (promptText && !isLoading) {
            submitMessage(promptText);
          }
        }
      });
    }
  }

  /**
   * Toggle the chat panel visibility with smooth slide-up animation
   * @param {boolean} open
   */
  function toggleChat(open) {
    isChatOpen = open;

    if (isChatOpen) {
      chatPanel.classList.remove("hidden-state");
      chatPanel.classList.add("open-state");
      launcherBtn.classList.remove("mm-pulse-animation");
      launcherBtn.setAttribute("aria-expanded", "true");

      // Auto-scroll to bottom and focus input
      scrollToBottom();
      setTimeout(function () {
        if (chatInput) {
          chatInput.focus();
        }
      }, 150);
    } else {
      chatPanel.classList.remove("open-state");
      chatPanel.classList.add("hidden-state");
      launcherBtn.classList.add("mm-pulse-animation");
      launcherBtn.setAttribute("aria-expanded", "false");
    }
  }

  /**
   * Handles user submission from the form
   */
  function handleFormSubmit() {
    if (!chatInput) return;
    const message = chatInput.value.trim();
    if (!message || isLoading) return;

    chatInput.value = "";
    submitMessage(message);
  }

  /**
   * Safely escapes HTML to prevent XSS attacks
   * @param {string} str
   * @returns {string}
   */
  function escapeHTML(str) {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  /**
   * Converts markdown-like formatting into clean HTML
   * Supports **bold**, *italic*, bullets, and linebreaks
   * @param {string} text
   * @returns {string}
   */
  function formatReplyMarkdown(text) {
    if (!text) return "";
    let safe = escapeHTML(text);

    // Bold **text**
    safe = safe.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");

    // Italic *text*
    safe = safe.replace(/\*([^*\n]+)\*/g, "<em>$1</em>");

    // Bullet lists: lines starting with - or *
    const lines = safe.split("\n");
    let inList = false;
    let formattedLines = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      const bulletMatch = line.match(/^[-*•]\s+(.*)$/);

      if (bulletMatch) {
        if (!inList) {
          inList = true;
          formattedLines.push('<ul class="list-disc pl-4 my-1 space-y-0.5">');
        }
        formattedLines.push(`<li>${bulletMatch[1]}</li>`);
      } else {
        if (inList) {
          inList = false;
          formattedLines.push("</ul>");
        }
        if (line.length > 0) {
          formattedLines.push(`<p class="my-1">${line}</p>`);
        }
      }
    }

    if (inList) {
      formattedLines.push("</ul>");
    }

    return formattedLines.join("");
  }

  /**
   * Appends user message bubble aligned right
   * @param {string} text
   */
  function appendUserMessage(text) {
    if (!messagesContainer) return;

    const row = document.createElement("div");
    row.className = "flex justify-end items-end";

    const bubble = document.createElement("div");
    bubble.className = "max-w-[82%] bg-primary text-white rounded-2xl rounded-br-xs px-3.5 py-2.5 text-[13px] leading-relaxed shadow-sm font-normal";
    bubble.textContent = text; // textContent automatically escapes

    row.appendChild(bubble);
    messagesContainer.appendChild(row);
    scrollToBottom();
  }

  /**
   * Shows a 3-dot pulsing loading indicator aligned left
   * @returns {HTMLElement} The loading indicator DOM element
   */
  function showLoadingIndicator() {
    if (!messagesContainer) return null;

    const row = document.createElement("div");
    row.className = "flex items-start gap-2.5 mm-loading-row";

    row.innerHTML = `
      <img src="${AVATAR_URL}" alt="AI Mentor" class="w-7 h-7 rounded-full object-cover flex-shrink-0 mt-0.5 border border-primary/20 shadow-xs" />
      <div class="bg-white text-on-surface border border-outline-variant/30 rounded-2xl rounded-tl-xs px-4 py-3 shadow-sm flex items-center gap-1.5">
        <span class="w-2 h-2 rounded-full bg-primary/70 animate-bounce" style="animation-delay: 0ms;"></span>
        <span class="w-2 h-2 rounded-full bg-primary/70 animate-bounce" style="animation-delay: 180ms;"></span>
        <span class="w-2 h-2 rounded-full bg-primary/70 animate-bounce" style="animation-delay: 360ms;"></span>
      </div>
    `;

    messagesContainer.appendChild(row);
    scrollToBottom();
    return row;
  }

  /**
   * Appends bot message bubble aligned left with founder avatar
   * @param {string} rawText
   * @param {boolean} isError
   */
  function appendBotMessage(rawText, isError = false) {
    if (!messagesContainer) return;

    const row = document.createElement("div");
    row.className = "flex items-start gap-2.5";

    const formattedContent = isError
      ? `<span class="text-error font-medium">${escapeHTML(rawText)}</span>`
      : formatReplyMarkdown(rawText);

    row.innerHTML = `
      <img src="${AVATAR_URL}" alt="AI Mentor" class="w-7 h-7 rounded-full object-cover flex-shrink-0 mt-0.5 border border-primary/20 shadow-xs" />
      <div class="max-w-[85%] bg-white text-on-surface border border-outline-variant/30 rounded-2xl rounded-tl-xs px-3.5 py-2.5 text-[13px] leading-relaxed shadow-sm">
        ${formattedContent}
      </div>
    `;

    messagesContainer.appendChild(row);
    scrollToBottom();
  }

  /**
   * Scrolls the message container smoothly to the bottom
   */
  function scrollToBottom() {
    if (messagesContainer) {
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
  }

  /**
   * Sends user prompt to the AI backend and handles the response
   * @param {string} userMessage
   */
  async function submitMessage(userMessage) {
    appendUserMessage(userMessage);

    // Disable input while loading
    isLoading = true;
    if (sendBtn) sendBtn.disabled = true;
    if (chatInput) chatInput.disabled = true;

    const loadingRow = showLoadingIndicator();

    try {
      const response = await fetch(API_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          message: userMessage
        })
      });

      if (!response.ok) {
        throw new Error(`Server returned status ${response.status}`);
      }

      const data = await response.json();

      // Remove loading indicator
      if (loadingRow && loadingRow.parentNode) {
        loadingRow.parentNode.removeChild(loadingRow);
      }

      if (data && data.success && data.reply) {
        appendBotMessage(data.reply);
      } else if (data && data.message) {
        appendBotMessage(data.message, true);
      } else {
        appendBotMessage("I could not generate a response. Please try asking again in a moment.", true);
      }
    } catch (err) {
      console.error("AI Chat Error:", err);
      if (loadingRow && loadingRow.parentNode) {
        loadingRow.parentNode.removeChild(loadingRow);
      }
      appendBotMessage(
        "I'm having trouble connecting to the MathsManthra AI server. Please make sure the AI assistant is running on port 4000 and try again.",
        true
      );
    } finally {
      isLoading = false;
      if (sendBtn) sendBtn.disabled = false;
      if (chatInput) {
        chatInput.disabled = false;
        chatInput.focus();
      }
    }
  }

  // Initialize once DOM is fully loaded
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initChatbot);
  } else {
    initChatbot();
  }
})();
