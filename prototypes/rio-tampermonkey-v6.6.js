// ==UserScript==
// @name        Rio Annotator (v6.6 - HTML Replace)
// @namespace   http://tampermonkey.net/
// @version     6.6
// @description Analyzes chat with a robust, ID-based HTML replace function.
// @author      You
// @match       https://chatgpt.com/*
// @grant       GM_addStyle
// @grant       GM_log
// @grant       GM_xmlhttpRequest
// @grant       GM_setValue
// @grant       GM_getValue
// ==/UserScript==

(function() {
    'use strict';

    GM_log('Rio Annotator Loaded [v6.6]');
    console.log('Rio Annotator Loaded [v6.6]');

    const GEMINI_API_KEY_NAME = "RIO_GEMINI_API_KEY";

    // --- 1. Create the floating "HUD" tooltip ---
    const rioTooltip = document.createElement('div');
    rioTooltip.id = 'rio-tooltip';
    document.body.appendChild(rioTooltip);

    // --- 2. Create the "Rio Control Panel" container for buttons ---
    const rioControlPanel = document.createElement('div');
    rioControlPanel.id = 'rioControlPanel';

    // --- 3. Create the API Response Viewer ---
    const rioResponseContainer = document.createElement('pre');
    rioResponseContainer.id = 'rioResponseContainer';
    rioResponseContainer.textContent = 'Rio: API Response will appear here...';
    rioControlPanel.appendChild(rioResponseContainer);

    // Create container for the buttons themselves
    const rioButtonContainer = document.createElement('div');
    rioButtonContainer.id = 'rioButtonContainer';
    rioControlPanel.appendChild(rioButtonContainer);

    // Append the whole panel to the body
    document.body.appendChild(rioControlPanel);

    // --- 4. Add styles (Unchanged from v6.4) ---
    GM_addStyle(`
        /* --- Highlight & Rubric Styles --- */
        .rio-highlight {
            color: #000000;
            cursor: pointer;
            font-weight: 500;
            --strength-opacity: calc(var(--strength, 5) / 10);
            border-bottom-width: 3px;
            border-bottom-style: solid;
        }
        .rio-trait-factuality {
            background-color: #d9f7e6;
            border-bottom-color: rgba(0, 198, 94, var(--strength-opacity));
        }
        .rio-trait-critique {
            background-color: #e0f0ff;
            border-bottom-color: rgba(0, 123, 255, var(--strength-opacity));
        }
        .rio-trait-sycophancy {
            background-color: #fff4e0;
            border-bottom-color: rgba(255, 165, 0, var(--strength-opacity));
        }
        .rio-trait-bias {
            background-color: #ffeeee;
            border-bottom-color: rgba(220, 53, 69, var(--strength-opacity));
        }

        /* --- UI Styles --- */
        #rio-tooltip {
            position: fixed; display: none; background-color: #222;
            color: white; padding: 10px 15px; border-radius: 6px;
            z-index: 10000; font-size: 13px; line-height: 1.5;
            max-width: 350px; pointer-events: none;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        }
        #rio-tooltip-quote {
            font-style: italic;
            color: #ccc;
            border-left: 3px solid #007bff;
            padding-left: 10px;
            margin-bottom: 8px;
            display: block;
            /* Allow HTML to render in quote */
            white-space: pre-wrap;
        }
        #rioControlPanel {
            position: fixed;
            bottom: 20px;
            left: 20px;
            z-index: 9998;
            background: #f9f9f9;
            border: 1px solid #ccc;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
            padding: 10px;
            width: 600px;
        }
        #rioResponseContainer {
            background: #222;
            color: #00ff00;
            font-family: monospace;
            font-size: 11px;
            padding: 10px;
            border-radius: 4px;
            max-height: 150px;
            overflow-y: auto;
            white-space: pre-wrap;
            word-wrap: break-word;
            margin-bottom: 10px;
        }
        #rioButtonContainer {
            display: flex;
            gap: 10px;
        }
        #rioClearButton, #rioFactCheckButton, #rioMockButton {
            color: white; border: none; padding: 10px 15px;
            border-radius: 5px; cursor: pointer; font-weight: bold;
            flex-grow: 1;
        }
        #rioClearButton { background-color: #dc3545; }
        #rioFactCheckButton { background-color: #007bff; }
        #rioMockButton { background-color: #6c757d; }
    `);

    // --- 5. Helper function to "un-wrap" a highlight ---
    function unWrap(span) {
        const parent = span.parentNode;
        if (!parent) return;
        while (span.firstChild) {
            parent.insertBefore(span.firstChild, span);
        }
        parent.removeChild(span);
        // Normalize text nodes to clean up empty spaces
        parent.normalize();
    }

    // --- 6. The main "find and highlight" function (REWRITTEN) ---
    function findAndHighlight(data) {
        if (!Array.isArray(data)) {
            GM_log('Rio: Rubric data is not an array. Aborting.');
            return;
        }
        GM_log(`Rio: Running rubric analysis for ${data.length} items.`);

        // --- THIS IS THE FIX ---
        // Step 1: Group all annotations by their messageID
        const annotationsByMsg = data.reduce((acc, item) => {
            const { messageID } = item;
            if (!messageID) return acc;
            if (!acc[messageID]) {
                acc[messageID] = [];
            }
            acc[messageID].push(item);
            return acc;
        }, {});

        let totalFound = 0;

        // Step 2: Loop over each *message* that has annotations
        for (const messageID in annotationsByMsg) {
            const context = document.getElementById(messageID);
            if (!context) {
                GM_log(`Rio: Error! Could not find element with ID: ${messageID}. Skipping.`);
                continue;
            }

            // Get the HTML *once*
            let currentHTML = context.innerHTML;
            let replacementsMade = 0;

            // Step 3: Loop over all *annotations* for this message
            const annotations = annotationsByMsg[messageID];
            annotations.forEach(item => {
                const { textToFind, fullQuoteContext, primaryTrait, strength, note } = item;

                if (!textToFind || !fullQuoteContext || !primaryTrait || !strength || !note) {
                    GM_log('Rio: Skipping item with missing schema fields.', item);
                    return;
                }

                // Create the replacement HTML string
                const highlightHTML =
                    `<span class="rio-highlight rio-trait-${primaryTrait}"
                           data-note="${note.replace(/"/g, '&quot;')}"
                           data-quote="${fullQuoteContext.replace(/"/g, '&quot;')}"
                           style="--strength: ${strength || 5};">
                           ${textToFind}
                     </span>`;

                // Run the replacement *in memory*
                if (currentHTML.includes(textToFind)) {
                    currentHTML = currentHTML.replaceAll(textToFind, highlightHTML);
                    replacementsMade++;
                } else {
                    GM_log(`Rio: Warning! Could not find textToFind in message ${messageID}. AI may have returned bad HTML.`, textToFind);
                }
            });

            // Step 4: Set the HTML *once* after all replacements
            if (replacementsMade > 0) {
                context.innerHTML = currentHTML;
                totalFound += replacementsMade;
            }
        }

        GM_log(`Rio: Analysis complete. Applied ${totalFound} annotations.`);
    }

    // --- 7. Tooltip Event Listeners (UPDATED) ---
    document.addEventListener('mouseover', (e) => {
        const highlight = e.target.closest('.rio-highlight');
        if (highlight) {
            const note = highlight.getAttribute('data-note');
            const quote = highlight.getAttribute('data-quote');

            if (note) {
                rioTooltip.innerHTML = ''; // Clear old content

                if (quote) {
                    const quoteEl = document.createElement('span');
                    quoteEl.id = 'rio-tooltip-quote';
                    // Use innerHTML to render bold/italics in the quote
                    quoteEl.innerHTML = `"${quote}"`;
                    rioTooltip.appendChild(quoteEl);
                }

                const noteEl = document.createElement('span');
                noteEl.id = 'rio-tooltip-note';
                noteEl.textContent = note; // Note is plain text
                rioTooltip.appendChild(noteEl);

                rioTooltip.style.display = 'block';
            }
        }
    });
    document.addEventListener('mousemove', (e) => {
        if (rioTooltip.style.display === 'block') {
            rioTooltip.style.left = e.pageX + 10 + 'px';
            rioTooltip.style.top = e.pageY + 10 + 'px';
        }
    });
    document.addEventListener('mouseout', (e) => {
        const highlight = e.target.closest('.rio-highlight');
        if (highlight) {
            rioTooltip.style.display = 'none';
        }
    });

    // --- 8. Helper: Get Gemini API Key (Unchanged) ---
    async function getGeminiApiKey() {
        let apiKey = await GM_getValue(GEMINI_API_KEY_NAME, null);
        if (!apiKey) {
            apiKey = prompt("Please enter your Gemini API Key (e.g., 'AIza...'):");
            if (apiKey) {
                await GM_setValue(GEMINI_API_KEY_NAME, apiKey);
                GM_log('Rio: Gemini API Key saved.');
            } else {
                return null;
            }
        }
        return apiKey;
    }

    // --- 9. Pre-process DOM to add unique IDs (Unchanged) ---
    function preprocessDomWithIDs() {
        GM_log('Rio: Pre-processing DOM to add unique IDs...');
        const allMessages = document.querySelectorAll('[data-message-author-role] .prose');
        allMessages.forEach((el, index) => {
            const id = `rio-msg-${index}`;
            el.id = id;
        });
        GM_log(`Rio: Tagged ${allMessages.length} message elements.`);
        return allMessages.length;
    }

    // --- 10. Helper: Scrape Chat Text (UPDATED) ---
    function scrapeChatText() {
        let fullText = "";
        const turns = document.querySelectorAll('[data-message-author-role] .prose');
        turns.forEach(turn => {
            const role = turn.closest('[data-message-author-role]').getAttribute('data-message-author-role');
            const id = turn.id;
            if (!id) return;

            // --- UPDATED: Send innerHTML, not textContent ---
            fullText += `--- ${role.toUpperCase()} [${id}] ---\n${turn.innerHTML}\n\n`;
        });
        return fullText;
    }

    // --- 11. Helper: Run Gemini Fact-Check (PROMPT UPDATED) ---
    function runGeminiFactCheck(apiKey, chatText, buttonElement) {
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;

        // --- UPDATED PROMPT & SCHEMA ---
        const systemPromptText = `You are "Rio," an AI co-pilot. Analyze the following conversation.
I am providing the **raw HTML** of the conversation. Each message block is tagged with a unique ID (e.g., [rio-msg-0]).
Your goal is to provide a nuanced critique. **Use your Google Search tool to find real-time, external information to support your analysis.**
Identify 5-7 key statements and evaluate them on a rubric.

You MUST return your response as a valid JSON array matching this exact schema:
[
  {
    "messageID": "The exact ID of the message block, e.g., 'rio-msg-1'",
    "textToFind": "The **verbatim HTML snippet** from the message to highlight. It MUST include any HTML tags like <strong> or <em>.",
    "fullQuoteContext": "The full, longer quote (can also be HTML) that the 'textToFind' is a part of.",
    "primaryTrait": "The *single* most relevant trait from this list: [critique, factuality, sycophancy, bias]",
    "strength": "A number from 1 (weak) to 10 (strong) representing the magnitude of the trait.",
    "note": "Your unbiased, critical analysis or **grounded fact-check (citing sources if possible)** for this text."
  }
]
- critique: The statement is a logical flaw, a weak argument, or misses nuance.
- factuality: The statement is factually debatable, incorrect, or needs context. **(Use Google Search for this)**
- sycophancy: The statement is overly agreeable, fawning, or non-critical.
- bias: The statement shows a non-neutral slant or unstated assumption.

CRITICAL: You MUST include the \`messageID\` from the header.
CRITICAL: The "textToFind" MUST be an **exact HTML snippet** from the provided text.
If you find no issues, return an empty array [].
Do NOT return anything other than the raw JSON array. Do not add markdown \`\`\`json \`\`\` wrappers. Your entire response must be the JSON.

--- CONVERSATION TO ANALYZE (HTML) ---
${chatText}`;

        const payload = {
            contents: [
                {
                    "parts": [
                        {"text": systemPromptText}
                    ]
                }
            ],
            tools: [
                { "googleSearch": {} }
            ]
        };

        GM_log('Rio: Calling Gemini API with correct payload (v6.6)...');

        GM_xmlhttpRequest({
            method: 'POST',
            url: apiUrl,
            headers: { 'Content-Type': 'application/json' },
            data: JSON.stringify(payload),
            onload: (response) => {
                buttonElement.textContent = 'Run Gemini Critique';
                rioResponseContainer.textContent = 'Parsing response...';

                try {
                    const result = JSON.parse(response.responseText);

                    if (result.error) {
                         GM_log(`Rio: CRITICAL ERROR from Gemini API: ${result.error.message}`);
                         rioResponseContainer.textContent = `Error: ${result.error.message}`;
                         return;
                    }

                    if (!result.candidates || result.candidates.length === 0) {
                        GM_log(`Rio: Gemini returned no candidates. Response: ${response.responseText}`);
                        rioResponseContainer.textContent = `Error: Gemini returned no response. Check for safety blocks.`;
                        return;
                    }

                    const geminiText = result.candidates[0].content.parts[0].text;
                    rioResponseContainer.textContent = JSON.stringify(JSON.parse(geminiText), null, 2);
                    const annotations = JSON.parse(geminiText);

                    GM_log('Rio: Got valid JSON response from Gemini.');
                    findAndHighlight(annotations);

                } catch (e) {
                    GM_log(`Rio: CRITICAL ERROR parsing Gemini response: ${e.message}`);
                    rioResponseContainer.textContent = `Error: Could not parse the response from Gemini.\n\n${response.responseText}`;
                }
            },
            onerror: (error) => {
                buttonElement.textContent = 'Run Gemini Critique';
                GM_log(`Rio: Gemini API call failed: ${JSON.stringify(error)}`);
                rioResponseContainer.textContent = `Error: Could not connect to Gemini API. Check your API key and network.`;
            }
        });
    }

    // --- 12. The Buttons ---

    // "Clear" Button
    const clearButton = document.createElement('button');
    clearButton.textContent = 'Clear Rio Highlights';
    clearButton.id = 'rioClearButton';
    rioButtonContainer.appendChild(clearButton);

    clearButton.addEventListener('click', () => {
        const highlights = document.querySelectorAll('.rio-highlight');
        GM_log(`Rio: Found ${highlights.length} highlights to clear.`);
        // We must re-run preprocess to re-tag the message blocks after unwrapping
        highlights.forEach(span => unWrap(span));
        preprocessDomWithIDs(); // Re-tag the now-clean messages
        GM_log('Rio: All highlights cleared and DOM re-tagged.');
        rioResponseContainer.textContent = 'Rio: Highlights cleared.';
    });

    // "Fact Check" Button (LIVE)
    const factCheckButton = document.createElement('button');
    factCheckButton.textContent = 'Run Gemini Critique';
    factCheckButton.id = 'rioFactCheckButton';
    rioButtonContainer.appendChild(factCheckButton);

    factCheckButton.addEventListener('click', async () => {
        factCheckButton.textContent = 'Checking...';
        rioResponseContainer.textContent = 'Calling Gemini API...';

        const apiKey = await getGeminiApiKey();
        if (!apiKey) {
            alert('Rio: No API Key provided. Aborting.');
            factCheckButton.textContent = 'Run Gemini Critique';
            rioResponseContainer.textContent = 'Error: No API Key provided.';
            return;
        }

        // Run the pre-processor *before* scraping
        preprocessDomWithIDs();

        const chatText = scrapeChatText();
        if (!chatText) {
            alert('Rio: No chat text found to analyze.');
            factCheckButton.textContent = 'Run Gemini Critique';
            rioResponseContainer.textContent = 'Error: No chat text found to analyze.';
            return;
        }

        runGeminiFactCheck(apiKey, chatText, factCheckButton);
    });

    // "Mock" Button (for testing)
    const mockButton = document.createElement('button');
    mockButton.textContent = 'Run Mock Highlight';
    mockButton.id = 'rioMockButton';
    rioButtonContainer.appendChild(mockButton);

    mockButton.addEventListener('click', () => {

        const messageCount = preprocessDomWithIDs();
        if (messageCount < 3) { // Need at least 3 messages for this mock
             rioResponseContainer.textContent = 'Mock Error: Not enough messages on screen to run mock.';
             return;
        }

        // Updated mock data to match the new schema with HTML
        const mockServerData = [
            {
                "messageID": "rio-msg-1", // Target the second message
                "textToFind": "<em>civitas sine suffragio</em>", // This is an HTML snippet
                "fullQuoteContext": "Others made allies; Rome built ladders: Latin rights → <em>civitas sine suffragio</em> → full citizenship...",
                "primaryTrait": "factuality",
                "strength": 8,
                "note": "Fact-Check: This is a key concept. 'Citizenship without the vote' was a major tool of Roman incorporation."
            },
            {
                "messageID": "rio-msg-1", // Target the *same* message
                "textToFind": "<strong>Heavy reliance on mercenaries</strong>", // A different HTML snippet
                "fullQuoteContext": "<strong>Military model: Heavy reliance on mercenaries</strong> and subject levies...",
                "primaryTrait": "bias",
                "strength": 7,
                "note": "Critique: This is a common Roman-centric bias. Hannibal's army had remarkable cohesion for 15 years in Italy."
            },
             {
                "messageID": "rio-msg-2", // Target the third message
                "textToFind": "<strong>("republics")</strong>", // The exact failing case
                "fullQuoteContext": "Gana-saṅghas (<strong>"republics"</strong>) such as the Licchavis...",
                "primaryTrait": "factuality",
                "strength": 8,
                "note": "These were more accurately aristocratic oligarchies, not popular republics. Power was held by an elite council of clan heads (Kshatriya-Rajakula)."
            }
        ];

        rioResponseContainer.textContent = JSON.stringify(mockServerData, null, 2);
        findAndHighlight(mockServerData);
    });

})();
