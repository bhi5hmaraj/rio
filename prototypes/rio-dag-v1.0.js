// ==UserScript==
// @name        Rio DAG (React Flow on ChatGPT v1.0)
// @namespace   http://tampermonkey.net/
// @version     1.0
// @description Injects React Flow into a sandboxed iframe on ChatGPT.
// @author      You
// @match       https://chatgpt.com/*
// @grant       GM_addStyle
// @grant       GM_getResourceText
// @grant       GM_log
//
// @resource    REACT       https://unpkg.com/react@18/umd/react.development.js
// @resource    REACT_DOM   https://unpkg.com/react-dom@18/umd/react-dom.development.js
// @resource    REACT_FLOW  https://cdn.jsdelivr.net/npm/reactflow@11.11.4/dist/umd/index.min.js
// @resource    REACT_FLOW_CSS https://cdn.jsdelivr.net/npm/reactflow@11.11.4/dist/style.min.css
// ==/UserScript==

(function() {
    'use strict';

    // Use GM_log for persistent logging, console.log for live debugging
    GM_log('Rio Script Loaded [v1.0 - ChatGPT]');
    console.log('Rio Script Loaded [v1.0 - ChatGPT]');

    // 1. --- Create the trigger button ---
    const rioButton = document.createElement('button');
    rioButton.textContent = 'Show Rio DAG (React Flow Test)';
    rioButton.id = 'rioTestButton';
    document.body.appendChild(rioButton);
    console.log('Rio: Button injected.');

    // 2. --- Add styles for the button and modal ---
    GM_addStyle(`
        #rioTestButton {
            position: fixed;
            bottom: 20px;
            left: 20px;
            z-index: 9998;
            background-color: #007bff;
            color: white;
            border: none;
            padding: 10px 15px;
            border-radius: 5px;
            cursor: pointer;
            font-weight: bold;
        }
        #rioModalBackdrop {
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            background-color: rgba(0, 0, 0, 0.8);
            z-index: 9999;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        #rioModalContent {
            background-color: white;
            width: 90%;
            height: 90%;
            border-radius: 8px;
            padding: 20px;
            box-sizing: border-box;
            color: black;
        }
        #rioIframe {
            width: 100%;
            height: 100%;
            border: none;
            background-color: white; /* Iframe background */
        }
        #rioCloseButton {
            position: absolute;
            top: 15px;
            right: 25px;
            font-size: 30px;
            color: white;
            cursor: pointer;
            user-select: none; /* Make it feel like a button */
        }
    `);

    // 3. --- Define the main function to run on click ---
    rioButton.addEventListener('click', () => {
        GM_log('Rio: Button clicked!');

        // Prevent multiple modals
        if (document.getElementById('rioModalBackdrop')) return;

        GM_log('Rio: Creating modal DOM...');
        const backdrop = document.createElement('div');
        backdrop.id = 'rioModalBackdrop';

        const closeButton = document.createElement('div');
        closeButton.id = 'rioCloseButton';
        closeButton.textContent = '×'; // Use textContent for safety
        backdrop.appendChild(closeButton);

        const content = document.createElement('div');
        content.id = 'rioModalContent';

        // --- THE IFRAME ---
        const iframe = document.createElement('iframe');
        iframe.id = 'rioIframe';

        content.appendChild(iframe);
        backdrop.appendChild(content);

        // This is the line that failed on Gemini but should work here.
        try {
            document.body.appendChild(backdrop);
            GM_log('Rio: Modal and iframe appended.');
        } catch (e) {
            GM_log(`Rio: CRITICAL ERROR appending modal: ${e.message}`);
            console.error('Rio: CRITICAL ERROR appending modal:', e);
            alert(`Rio Error: Could not append modal. Error: ${e.message}`);
            return;
        }

        closeButton.onclick = () => {
            GM_log('Rio: Close button clicked.');
            backdrop.remove();
        };

        GM_log('Rio: Writing to iframe document...');

        // --- THE IFRAME SANDBOX ---
        const iframeDoc = iframe.contentWindow.document;

        // Get all our library code from Tampermonkey's resources
        const reactCode = GM_getResourceText('REACT');
        const reactDomCode = GM_getResourceText('REACT_DOM');
        const reactFlowCode = GM_getResourceText('REACT_FLOW');
        const reactFlowCss = GM_getResourceText('REACT_FLOW_CSS');

        // This is our "Hello World" app, to be run inside the iframe
        const appScriptCode = `
            (function() {
                // This console.log will appear in the IFRAME's console
                console.log('Rio (iframe): App script running.');

                const React = window.React;
                const ReactDOM = window.ReactDOM;
                const ReactFlowModule = window.ReactFlow;

                if (!React || !ReactDOM || !ReactFlowModule) {
                    console.error('Rio (iframe): FATAL: Libraries not found!', { React, ReactDOM, ReactFlowModule });
                    document.body.innerHTML = '<h1>Error: Libraries not found.</h1>';
                    return;
                }

                // Handle if ReactFlow is loaded as default or not
                const ReactFlow = ReactFlowModule.default || ReactFlowModule;
                const Controls = ReactFlowModule.Controls;
                const Background = ReactFlowModule.Background;

                const initialNodes = [
                    { id: '1', type: 'input', data: { label: 'This is Rio!' }, position: { x: 250, y: 5 } },
                    { id: '2', data: { label: 'React Flow is embedded' }, position: { x: 250, y: 100 } },
                    { id: '3', type: 'output', data: { label: 'On ChatGPT!' }, position: { x: 250, y: 200 } },
                ];
                const initialEdges = [
                    { id: 'e1-2', source: '1', target: '2', animated: true },
                    { id: 'e1-3', source: '2', target: '3' },
                ];

                const App = () => {
                    return React.createElement(
                        'div',
                        { style: { width: '100%', height: '100%' } },
                        React.createElement(
                            ReactFlow,
                            { nodes: initialNodes, edges: initialEdges, fitView: true },
                            React.createElement(Controls),
                            React.createElement(Background, { color: '#aaa', gap: 16 })
                        )
                    );
                };

                console.log('Rio (iframe): Rendering React app...');
                const root = ReactDOM.createRoot(document.getElementById('root'));
                root.render(React.createElement(App));
                console.log('Rio (iframe): Render complete.');
            })();
        `;

        // Write the full, new HTML document into the iframe
        iframeDoc.open();
        iframeDoc.write(`
            <html>
            <head>
                <style>
                    /* Basic resets for the iframe body */
                    body { margin: 0; padding: 0; }
                    /* This is the root where our app will live */
                    #root { width: 100vw; height: 100vh; }
                    /* Inject the React Flow CSS */
                    ${reactFlowCss}
                </style>
            </head>
            <body>
                <div id="root">Loading Rio...</div>

                <!-- Inject the libraries as text. They will execute in order. -->
                <script>${reactCode}</script>
                <script>${reactDomCode}</script>
                <script>${reactFlowCode}</script>

                <!-- Run our app script -->
                <script>${appScriptCode}</script>
            </body>
            </html>
        `);
        iframeDoc.close();

        GM_log('Rio: Iframe document written and closed. You should see the flow chart.');
    });

})();
