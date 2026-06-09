// ==UserScript==
// @name         文字選取工具箱
// @namespace    https://github.com/naimiliu/text-selection-toolbox
// @version      1.0.15.21
// @description  文字選取後,顯示命令列
// @icon         https://raw.githubusercontent.com/naimiliu/text-selection-toolbox/main/options.svg
// @author       naimiliu
// @match        https://*/*
// @exclude      *://*.bankchb.com/*
// @grant        GM_xmlhttpRequest
// @run-at       document-end
// @require      https://cdn.jsdelivr.net/npm/pinyin-pro@3.28.1/dist/index.min.js
// @updateURL    https://raw.githubusercontent.com/naimiliu/text-selection-toolbox/main/main.user.js
// @downloadURL  https://raw.githubusercontent.com/naimiliu/text-selection-toolbox/main/main.user.js
// ==/UserScript==
/* global pinyinPro */

(function () {
    'use strict';

    function init() {
        const host = document.createElement('div');
        host.id = "my-reader-overlay";
        Object.assign(host.style, {
            position: 'fixed',
            top: '0',
            left: '0',
            width: '100vw',
            height: '100vh',
            zIndex: '2147483647',
            overflow: 'hidden',
            WebkitOverflowScrolling: 'touch',
            pointerEvents: 'none'
        });
        const shadow = host.attachShadow({
            mode: 'open'
        });
        document.body.appendChild(host);


        let { html } = pinyinPro;
        const speaker = new ConsistentLongTextSpeaker();
        // ---- 文字選取相關變數
        let selectedText = "";
        let savedSelection = null; // 用來暫存文字選取範圍
        // ---- 彈窗相關變數
        const speakerIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 16 16"><path d="M0 0h16v16H0z" fill="none" /><g fill="currentColor"><path d="M9.293 1c.39 0 .707.317.707.707v12.586a.707.707 0 0 1-1.207.5L5 11V5l3.793-3.793a.7.7 0 0 1 .5-.207M12 2.804a6 6 0 0 1 0 10.392l-.5-.866a5 5 0 0 0 0-8.66z" /><path d="M11 4.536a4 4 0 0 1 0 6.928l-.5-.866a3 3 0 0 0 0-5.196zM4 11H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h1z" /></g></svg>`;        
        let isDragging = false;
        let dragOffsetX = 0;
        let dragOffsetY = 0;

        const style = document.createElement('style');
        style.textContent = `
            :host {
                all: initial;
                font-family: "Microsoft Yahei", Arial, sans-serif;
                display:flex; position:fixed; top:0; left:0; width:100%; height:100%;
                justify-content: center; overflow: hidden;
                z-index:999999; 
                -webkit-overflow-scrolling: touch;
                pointer-events: none; 
            }
            #toolbox {
                display: none; flex-direction: row; position: fixed; 
                min-width: 232px; 
                color: black;background: white; 
                padding: 10px; border: 1px solid #ccc; 
                border-radius: 20px; 
                box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1); z-index: 2147483647;   
                pointer-events: auto; 
            }
            #toolbox.show { display: flex; }
            #toolbox button {
                background: none;
                border: none;
                color: #007BFF;
                cursor: pointer;
                font-size: 14px;
            }
            #toolbox button:hover {
                color: #0056b3;
            }
            #popup {
                display: none; position: fixed; 
                font-family: "Microsoft JhengHei", Arial, sans-serif; 
                width: 400px; height: auto;
                background: white; border: 1px solid #ccc;
                box-shadow: 0 4px 10px rgba(0,0,0,0.2); border-radius: 8px; overflow: hidden; z-index: 2147483647;
                pointer-events: auto;
            }  
            #popup.show { display: block; }
            #popup button:hover {
                color: red;
            }
            #popup-translation-source {
                display: flex;
                align-item: flex-start;
                border-bottom: 1px solid #eee;
            }
            #popup-translation-transalted {
                display: flex;
                align-item: flex-start;
                margin-bottom: 10px;
            }
            .popup-speaker {
                width: 24px;
                height: 24px;
                display: inline-block;
                flex-shrink: 0;
                background: transparent;
                border: none;
                margin-right: 8px;
                padding-top: 5px;
            }
            #popup-translation-source p, #popup-translation-transalted p {
                margin:0;
                flex-grow: 1;
            }
            
            #popup-translation-source.collapse {
                cursor: pointer;
            }
            
            #popup-translation-source.collapse p {
                display: -webkit-box;
                -webkit-line-clamp: 1;
                -webkit-box-orient: vertical;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            #popup-translation-source.collapse::after{
                content: "▼";
                font-size: 0.8em;
                color: #888;
                margin-left: 8px;
                flex-shrink: 0;
            }
            #popup-translation-source.expanded p{
                display: block;
                overflow: visible;
            }
            #popup-translation-source.expanded::after{
                content: "▲";
                font-size: 0.8em;
                color: #888;
                margin-left: 8px;
                flex-shrink: 0;
            }
            
            .py-result-item {
                line-height: 2.5;
                padding-right: 5px;
            }
        `;
        shadow.appendChild(style);

        // 面板建立
        const toolbox = document.createElement("div");
        toolbox.id = "toolbox";
        toolbox.innerHTML = `
            <button id="option1">複製</button>
            <button id="option2">搜尋</button>
            <button id="option3">朗讀</button>
            <button id="option4">翻譯</button>
            <button id="option5">拼音</button>
        `;
        shadow.appendChild(toolbox);

        const popup = document.createElement("div");
        popup.id = "popup";
        popup.innerHTML = `
            <div id="popup-header" style="background: #f1f3f4; padding: 5px 10px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #eee;cursor:move;">
               <span id="popup-title" style="font-size: 14px; font-weight: bold; color: #5f6368;">...</span>
               <button id="close-popup" style="border: none; background: transparent; cursor: pointer; font-size: 16px;">X</button>
            </div>
            <div id="popup-result" style="padding: 15px; font-size: 20px; min-height: 40px; max-height: 220px; overflow-y: auto; overflow-x: hidden; line-height: 1.5; word-break: break-word;"><span class="hover-word">loading</span></div>
        `;
        shadow.appendChild(popup);
        const popupHeader = popup.querySelector("#popup-header");
        const popupTitle = popup.querySelector("#popup-title");
        const closePopup = popup.querySelector("#close-popup");
        const popupResult = popup.querySelector("#popup-result");


        const showMessage = (msg, centerX, centerY) => {
            const container = document.createElement("div");
            container.style.position = 'fixed';
            container.style.left = `${centerX ?? '50%'}`;
            container.style.top = `${centerY ?? '50%'}`;;
            // ⭐ 初始狀態：置中，並且大小是正常 1 倍 (scale(1))
            container.style.transform = 'translate(-50%, -50%) scale(1)';
            container.style.padding = '15px';
            container.style.borderRadius = '8px';
            container.style.background = '#4e4c4c';
            container.style.color = '#ffffff';
            container.style.fontSize = '20px';
            container.style.opacity = '1';

            // ⭐ 核心修改：將 opacity 改成 all，這樣透明度和大小變動都會有 0.3 秒的流暢動畫
            // （縮小動畫建議用 0.3s ~ 0.5s，1s 會顯得有點太慢、太拖沓）
            container.style.transition = 'all 0.3s ease-out';

            container.style.pointerEvents = 'none';
            container.textContent = msg;
            shadow.append(container);

            setTimeout(() => {
                container.style.opacity = '0';
                // ⭐ 核心修改：保持置中，但尺寸縮小到 0.8 倍
                container.style.transform = 'translate(-50%, -50%) scale(0.5)';

                // 因為動畫改成了 0.3 秒 (0.3s)，所以這裡移除元件的等待時間也同步改成 300 毫秒
                setTimeout(() => {
                    shadow.removeChild(container);
                }, 300);

            }, 2000); // 顯示 2 秒後開始縮小淡出
        };

        let popupType = null;
        const loadPopupResult = (text) => {
            if (!popupType) return;

            if (popupType === '拼音') {
                const sentences = text.split(/([。？！；…\n\r]|\,\s*)/g)
                    .map(s => s.trim())
                    .filter(s => s.length > 0)
                    .reduce((acc, current) => {
                        const punctuations = ["。", "？", "！", "；", "…", ",", "”", "“", "‘", "’"];
                        if (punctuations.includes(current) && acc.length > 0) {
                            acc[acc.length - 1] += current;
                        } else {
                            acc.push(current);
                        }
                        return acc;
                    }, []);
                let pinyinHtml = "";
                sentences.forEach(sentence => {
                    pinyinHtml += "<div style='text-indent:2em'>" + html(sentence) + "</div>";
                });
                popupResult.innerHTML = pinyinHtml;
            }
            else if (popupType === '翻譯') {
                const targetLang = /[\u4e00-\u9fa5]/.test(selectedText) ? 'en' : 'zh-TW';
                const apiUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&dt=bd&q=${encodeURIComponent(text)}`;
                GM_xmlhttpRequest({
                    method: "GET",
                    url: apiUrl,
                    onload: function (response) {
                        const data = JSON.parse(response.responseText);
                        if (data && data[0]) {
                            let source, translated;
                            data[0].forEach(row => {
                                if (row[0]) {
                                    translated = getHoverWord(row[0].trim());
                                }
                                if(row[1]) {
                                    source = getHoverWord(row[1].trim());
                                }
                            });
                            popupResult.innerHTML = "";
                            if(source){
                                const sourceDiv = document.createElement('div');
                                sourceDiv.id = 'popup-translation-source';
                                sourceDiv.className = 'collapse';
                                const btn = document.createElement('button');
                                btn.className = 'popup-speaker';
                                btn.innerHTML = speakerIcon;
                                sourceDiv.appendChild(btn);
                                const p =document.createElement('p');
                                p.appendChild(source);
                                sourceDiv.appendChild(p);
                                popupResult.appendChild(sourceDiv);
                            }
                            if(translated) {
                                const translatedDiv = document.createElement('div');
                                translatedDiv.id = 'popup-translation-translated';
                                const btn = document.createElement('button');
                                btn.className = 'popup-speaker';
                                btn.innerHTML = speakerIcon;
                                translatedDiv.appendChild(btn);
                                const p =document.createElement('p');
                                p.appendChild(translated);
                                translatedDiv.appendChild(p);
                                popupResult.appendChild(translatedDiv);
                            }
                        }
                        else {
                            popupResult.textContent = '翻譯出錯';
                        }
                    }
                });
            }
        };

        const getHoverWord = (text) => {
            // 建立一個虛擬的 DocumentFragment 容器，用來打包所有元件，提升效能
            const fragment = document.createDocumentFragment();
            if(text) {
                // 使用正則表達式，把英文單字或個別中文字切開
                // \w+'?\w* 代表英文單字(含don't), [\u4e00-\u9fa5] 代表中文字
                const tokens = text.replace(/&nbsp;|&emsp;|&ensp;|　|  /g, '').trim().split(/(\w+'?\w*|[\u4e00-\u9fa5]|\s+|[]+)/g);
                
                tokens.forEach(token => {
                    if (!token) return;
                    
                    if (token.trim().length > 0) {
                        // 直接建立真正的 span 元件
                        const span = document.createElement('span');
                        span.className = 'hover-word';
                        span.textContent = token; // 使用 textContent 可以自動過濾並轉義所有危險字元
                        // 將 span 塞入虛擬容器
                        fragment.appendChild(span);
                    } else {
                        // 空白或換行則建立純文字節點（TextNode）保留
                        const textNode = document.createTextNode(token);
                        fragment.appendChild(textNode);     
                    }
                });

            }
            return fragment;
        };

        // 工具箱事件監聽
        // --- 複製
        toolbox.querySelector("#option1").addEventListener("click", () => {
            navigator.clipboard.writeText(selectedText).then(() => {
                const selection = window.getSelection()
                const rect = selection.getRangeAt(0).getBoundingClientRect();
                showMessage("Copied!", `${rect.left + rect.width / 2}px`, `${rect.top - 30}px`);
                selection.removeAllRanges();
                toolbox.classList.remove("show");
            });
        });
        // --- 搜尋
        toolbox.querySelector("#option2").addEventListener("click", () => {
            const query = encodeURIComponent(selectedText);
            window.open(`https://www.google.com/search?q=${query}`, '_blank');
        });
        // --- 朗讀
        toolbox.querySelector("#option3").addEventListener("click", () => {
            speaker.speak(selectedText);
        });
        // --- 翻譯
        toolbox.querySelector("#option4").addEventListener("click", (e) => {
            /* --- 開新視窗
            const query = encodeURIComponent(selectedText);

            // 有中文則翻譯成英文，沒有中文則翻譯成中文
            const targetLang = /[\u4e00-\u9fa5]/.test(selectedText) ? 'en' : 'zh-TW';
            const translateUrl = `https://translate.google.com/?sl=auto&tl=${targetLang}&op=translate&text=${query}`;
            window.open(`https://translate.google.com/?sl=auto&tl=${targetLang}&op=translate&text=${query}`, '_blank');
            --- */

            // 彈窗
            if (popup.classList.contains("show") && popupType === '翻譯') {
                popup.classList.remove("show");
                return;
            }
            popupType = '翻譯';
            popup.classList.add("show");
            popupTitle.innerText = "Google 翻譯";
            popup.style.left = `${e.pageX + 10}px`;
            popup.style.top = `${e.pageY + 10}px`;
        });
        // --- 拼音
        toolbox.querySelector("#option5").addEventListener("click", (e) => {
            if (popup.classList.contains("show") && popupType === '拼音') {
                popup.classList.remove("show");
                return;
            }
            popupType = '拼音';
            popup.classList.add("show");
            popupTitle.innerText = '拼音';
            popup.style.left = `${e.pageX + 10}px`;
            popup.style.top = `${e.pageY + 10}px`;
        });
        // 彈窗事件監聽
        popup.addEventListener("mouseup", e => {
            e.stopPropagation();
            toolbox.classList.remove("show");
        });
        // --- 關閉彈窗
        closePopup.addEventListener("click", () => {
            popup.classList.remove("show");
        });

        //--- 拖動彈窗
        popupHeader.addEventListener("mousedown", e => {
            e.preventDefault();

            // 暫存當前的文字選取範圍，避免拖動過程中選取消失
            const selection = shadow.getSelection();
            if (selection.rangeCount > 0) {
                savedSelection = selection.getRangeAt(0).cloneRange();
            }

            isDragging = true;
            const rect = popup.getBoundingClientRect();
            dragOffsetX = e.clientX - rect.left;
            dragOffsetY = e.clientY - rect.top;
        });
        host.addEventListener("mousemove", e => {
            if (!isDragging) return;

            // 移動時防止滑鼠選取到畫面上的其他文字
            e.preventDefault();

            popup.style.left = `${e.clientX - dragOffsetX}px`;
            popup.style.top = `${e.clientY - dragOffsetY}px`;

            // 在移動過程中，不斷強制將選取狀態補回來
            if (savedSelection) {
                const selection = shadow.getSelection();
                selection.removeAllRanges();
                selection.addRange(savedSelection);
            }
        });
        popupHeader.addEventListener("mouseup", e => {
            e.preventDefault();
            e.stopPropagation();
            isDragging = false;
        });

        //--- 點你就唸
        let speakTimeout = null;
        popupResult.addEventListener("mousemove", e => {
            e.preventDefault();
            e.stopPropagation();

            // 檢查滑鼠當下指著的，是不是我們剛剛包裝好的文字標籤
            if (!e.target.classList.contains('hover-word')) return;

            if (speakTimeout) {
                clearTimeout(speakTimeout);
            }

            const targetText = e.target.innerText.trim();
            if (targetText && targetText.length >= 1) {
                speakTimeout = setTimeout(() => {
                // 直接從元件精準抓字，百分之百成功，完全無視 Shadow DOM 跨域限制！
                    speaker.speak(targetText);
                    speakTimeout = null;
                }, 500); // 依據您的腳本設定，滑鼠停留在字上面 1 秒後觸發
            }
        });
        popupResult.addEventListener('mouseleave', () => {
            if (speakTimeout) {
                clearTimeout(speakTimeout);
                speakTimeout = null;
            }
        });
        // 翻譯彈窗內容事件
        popupResult.addEventListener('mouseup', (e) => {
            if (speakTimeout) {
                clearTimeout(speakTimeout);
                speakTimeout = null;
            }
            // speaker 
            const speakerBtn = e.target.closest('.popup-speaker');
            if(speakerBtn) {
                const text = speakerBtn.parentElement.textContent;
                speaker(text);
                return;
            }
            // 原文收合/展開
            const target = e.target.closest('#popup-translation-source');
            if(target) {
                target.classList.toggle('collapse');
                target.classList.toggle('expanded');
            }
        });
        
        document.addEventListener("mouseup", (e) => {
            setTimeout(() => {
                // 取得目前選取的 Selection 物件
                const selection = window.getSelection();

                // 將選取內容轉為純文字並去除前後多餘空白
                selectedText = selection.toString().trim();
                if (selectedText.length > 0) {
                    // 顯示自定義選單
                    toolbox.classList.add("show");
                    const rect = selection.getRangeAt(0).getBoundingClientRect();
                    toolbox.style.top = `${rect.top - toolbox.offsetHeight - 10}px`;
                    toolbox.style.left = `${rect.left + (rect.width / 2) - (toolbox.offsetWidth / 2)}px`;
                    loadPopupResult(selectedText);
                }
                else {
                    if (toolbox.contains(e.target)) return;
                    toolbox.classList.remove("show");
                    popup.classList.remove("show");
                }

            }, 100);
        });
    }

    class ConsistentLongTextSpeaker {
        constructor() {
            this.synth = window.speechSynthesis;
            this.targetVoice = null;
            this.config = {
                lang: 'zh-TW',
                rate: 1.0,
                pitch: 1.0,
                volume: 1.0
            };

            // 初始化語音庫（處理 getVoices 非同步載入問題）
            this._initVoices();
        }

        _initVoices() {
            const loadVoices = () => {
                const voices = this.synth.getVoices();
                // 優先尋找微軟台灣曉臻（常見且好聽），次之選取任何台灣中文，最後保底中文
                this.targetVoice = voices.find(v => (v.name.includes("曉臻") || v.name.includes("Hsiaochen")) && v.lang === "zh-TW")
                    || voices.find(v => v.name.includes("臺灣") && v.lang === "zh-TW")
                    || voices.find(v => v.lang === "zh-TW")
                    || voices.find(v => v.lang.includes("zh"));
                //console.log("可用語音列表：", voices);
                if (!this.targetVoice) {
                    console.log("未找到符合的語音");
                } else {
                    console.log("選定的語音：", this.targetVoice.name, this.targetVoice.lang);
                }
            };

            loadVoices();
            if (this.synth.onvoiceschanged !== undefined) {
                this.synth.onvoiceschanged = loadVoices;
            }
        }

        /**
         * 將長文字切編成短句陣列
         */
        _splitText(text) {
            // 使用正規表達式，依據常見標點符號切分，並過濾掉空白字串
            return text.split(/([。？！；…\n\r]|\,\s*)/g)
                .map(s => s.trim())
                .filter(s => s.length > 0)
                .reduce((acc, current) => {
                    // 重新把標點符號接回前一句的尾巴，讓語氣更自然
                    const punctuations = ["。", "？", "！", "；", "…", ","];
                    if (punctuations.includes(current) && acc.length > 0) {
                        acc[acc.length - 1] += current;
                    } else {
                        acc.push(current);
                    }
                    return acc;
                }, []);
        }

        /**
         * 開始播放長文字
         */
        speak(longText) {
            // 1. 先停止目前正在播放或排隊的語音，清除狀態
            this.synth.cancel();

            if (!longText) return;

            // 2. 切割文字
            const sentences = this._splitText(longText);
            console.log("切片後的句子：", sentences);

            // 3. 依序將切片丟入瀏覽器播放隊列
            sentences.forEach((sentence, index) => {
                const utterance = new SpeechSynthesisUtterance(sentence);

                // 核心：每一句都強制綁定相同的語音與參數
                if (this.targetVoice) {
                    utterance.voice = this.targetVoice;
                }
                utterance.lang = this.config.lang;
                utterance.rate = this.config.rate;
                utterance.pitch = this.config.pitch;
                utterance.volume = this.config.volume;

                // 可選：監聽事件（例如追蹤進度）
                if (index === 0) {
                    utterance.onstart = () => console.log("長文字開始播放...");
                }
                if (index === sentences.length - 1) {
                    utterance.onend = () => console.log("全部文字播放完畢！");
                }

                // 丟入全域播放佇列，瀏覽器會自動順序播放
                this.synth.speak(utterance);
            });
        }

        /**
         * 隨時停止播放
         */
        stop() {
            this.synth.cancel();
        }
    }


    if (document.readyState === 'complete') init();
    else window.addEventListener('load', init);
})();
