// ==UserScript==
// @name         文字選取工具箱
// @namespace    https://github.com/naimiliu/text-selection-toolbox
// @version      1.0.12
// @description  文字選取後,顯示命令列
// @icon         https://raw.githubusercontent.com/naimiliu/text-selection-toolbox/main/options.svg
// @author       naimiliu
// @match        https://*/*
// @exclude      *://*.bankchb.com/*
// @grant        none
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
        let isSelecting = false;
        let savedSelection = null; // 用來暫存文字選取範圍
        // ---- 拼音視窗相關變數
        let isFirstDisplay = true;
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
                box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1); z-index: 2147483647; }
            }
            #toolbox.show { display: flex;  pointer-events: auto; }
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
            #pinyin-display {
                display: none; position: fixed; 
                font-family: "Microsoft JhengHei", Arial, sans-serif; 
                min-width: 250px; max-width: 400px; 
                background: #fff; border: 2px solid #0056b3; 
                border-radius: 8px; padding: 0px; z-index: 2147483647; }  
            }
            #pinyin-display.show { display: block; pointer-events: auto; }
            #pinyin-display button {
                position: absolute;
                top: 3px; right: 10px;
                background: none;
                border: none;
                color: #fff;
                cursor: pointer;
                font-size: 14px;
            }
            #pinyin-display button:hover {
                color: red;
            }
            #pinyin-display-header { display: flex; cursor: move; background: #007BFF; color: white; height: 30px; padding-left: 10px;  border-top-left-radius: 8px; border-top-right-radius: 8px; align-items: center; justify-content: space-between; }
            #pinyin-display-content {
                font-family: "Microsoft JhengHei", sans-serif;
                background: white; 
                color: black; 
                border: 1px solid #ccc;
                padding: 20px 12px;
                margin-top: 5px;
                font-size: 16px;
                line-height: 2.5;
                overflow-y: scroll;
                overflow-x: hidden;
                max-height: 300px;
            }
            .py-result-item {
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

        const pinyinDisplay = document.createElement("div");
        pinyinDisplay.id = "pinyin-display";
        pinyinDisplay.innerHTML = `
            <div id="pinyin-display-header"><span id="pinyin-display-title" style="padding:10px;">pinyin</span><button id="close-pinyin-display">X</button></div>
            <div id="pinyin-display-content"></div>
        `;
        shadow.appendChild(pinyinDisplay);

        const showMessage = (msg, options={s:10, x:window.clientX, y:window.clientY}) => {
            const container = document.createElement("div");
            container.style.position = 'fixed';
            container.style.left = options.x;
            container.style.top = options.y;
            container.style.padding = '15px';
            container.style.background = '#221e1e';
            container.style.color = '#ffffff';
            container.textContent = msg;
            shadow.append(container);
            setTimeout(() => {
                //shadow.removeChild(container);
            },options.s*1000);
        };

        const refreshPinyinDisplayContent = (text) => {
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
                pinyinHtml += html(sentence) + "<br>";
            });
            pinyinDisplay.querySelector("#pinyin-display-content").innerHTML = pinyinHtml;
        }


        // 工具箱事件監聽
        // --- 複製
        toolbox.querySelector("#option1").addEventListener("click", () => {
            navigator.clipboard.writeText(selectedText).then(() => {
                window.getSelection().removeAllRanges();
                toolbox.classList.remove("show");
                showMessage("Copied!");
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
        toolbox.querySelector("#option4").addEventListener("click", () => {
            const query = encodeURIComponent(selectedText);

            // 有中文則翻譯成英文，沒有中文則翻譯成中文
            const targetLang = /[\u4e00-\u9fa5]/.test(selectedText) ? 'en' : 'zh-TW';
            window.open(`https://translate.google.com/?sl=auto&tl=${targetLang}&op=translate&text=${query}`, '_blank');
        });
        // --- 拼音
        toolbox.querySelector("#option5").addEventListener("click", (e) => {
            if ( pinyinDisplay.classList.contains("show") ) {
                pinyinDisplay.classList.remove("show");
                return;
            }
            pinyinDisplay.classList.add("show");
            if(isFirstDisplay) {
                isFirstDisplay = false;
                pinyinDisplay.style.left = `${e.clientX + 10}px`;
                pinyinDisplay.style.top = `${e.clientY - 10}px`;
            }
        });
        // 拼音事件監聽
        // --- 關閉拼音
        pinyinDisplay.querySelector("#close-pinyin-display").addEventListener("click", () => {
            pinyinDisplay.classList.remove("show");
        });

        //--- 拖動彈窗
        pinyinDisplay.querySelector("#pinyin-display-header").addEventListener("mousedown", e => {
            e.preventDefault();

            // 暫存當前的文字選取範圍，避免拖動過程中選取消失
            const selection = shadow.getSelection();
            if (selection.rangeCount > 0) {
                savedSelection = selection.getRangeAt(0).cloneRange();
            }

            isDragging = true;
            const rect = pinyinDisplay.getBoundingClientRect();
            dragOffsetX = e.clientX - rect.left;
            dragOffsetY = e.clientY - rect.top;
        });
        host.addEventListener("mousemove", e => {
            if (!isDragging) return;

            // 移動時防止滑鼠選取到畫面上的其他文字
            e.preventDefault();

            pinyinDisplay.style.left = `${e.clientX - dragOffsetX}px`;
            pinyinDisplay.style.top = `${e.clientY - dragOffsetY}px`;

            // 在移動過程中，不斷強制將選取狀態補回來
            if (savedSelection) {
                const selection = shadow.getSelection();
                selection.removeAllRanges();
                selection.addRange(savedSelection);
            }
        });
        pinyinDisplay.querySelector("#pinyin-display-header").addEventListener("mouseup", e => {
            e.preventDefault();
            e.stopPropagation();
            isDragging = false;
        });

        document.addEventListener("mouseup", (e) => {
            setTimeout(() => {
                // 取得目前選取的 Selection 物件
                const selection = window.getSelection();

                // 將選取內容轉為純文字並去除前後多餘空白
                selectedText = selection.toString().trim();
console.log("selectedText", selectedText);
                if (selectedText.length > 0) {
                    // 顯示自定義選單
                    toolbox.classList.add("show");
                    toolbox.style.display = 'flex';
                    const rect = selection.getRangeAt(0).getBoundingClientRect();
                    toolbox.style.top = `${rect.top - toolbox.offsetHeight - 10}px`;
                    toolbox.style.left = `${rect.left + (rect.width / 2) - (toolbox.offsetWidth / 2)}px`;
                    // 更新彈窗內容
                    refreshPinyinDisplayContent(selectedText);
                }
                else {
                    /*
                    toolbox.classList.remove("show");
                    pinyinDisplay.classList.remove("show");
                    */
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
