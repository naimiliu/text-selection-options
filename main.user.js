// ==UserScript==
// @name         文字選取選項插件
// @namespace    https://github.com/naimiliu/text-selection-options
// @version      1.0.9
// @description  文字選取後,顯示命令列
// @icon         https://raw.githubusercontent.com/naimiliu/text-selection-options/main/options.svg
// @author       naimiliu
// @match        https://*/*
// @grant        none
// @run-at       document-end
// @require      https://cdn.jsdelivr.net/npm/pinyin-pro@3.28.1/dist/index.min.js
// @updateURL    https://raw.githubusercontent.com/naimiliu/text-selection-options/main/main.user.js
// @downloadURL  https://raw.githubusercontent.com/naimiliu/text-selection-options/main/main.user.js

// ==/UserScript==
/* global pinyinPro */

(function() {
    'use strict';

    function init() {
        let selectedText = "";
        let { html } = pinyinPro;

        const style = document.createElement('style');
        style.textContent = `
            #text-options {
                display: none; position: fixed; 
                top: 0px; left: 0px; 
                background: white; color: black; 
                padding: 10px; border: 1px solid #ccc; 
                border-radius: 20px; z-index: 9999;
                box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
            }
            #text-options button {
                background: none;
                border: none;
                color: #007BFF;
                cursor: pointer;
                font-size: 14px;
                margin: 0 5px;
            }
            #text-options button:hover {
                color: #0056b3;
            }
            #popup {
                display: none; position: fixed; 
                top: 0px; left: 0px; 
                background: #8b8b8b; color: white; 
                border-radius: 5px; z-index: 9999;
                min-width: 200px; max-width: 400px;
                padding: 0px;
            }
            #popup button {
                position: absolute;
                top: 3px; right: 10px;
                background: none;
                border: none;
                color: #fff;
                cursor: pointer;
                font-size: 14px;
            }
            #popup button:hover {
                color: red;
            }
            #popup-content {
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
        document.head.appendChild(style);

        const options = document.createElement("div");
        options.id = "text-options";
        options.innerHTML = `
            <button id="option1">複製</button>
            <button id="option2">搜尋</button>
            <button id="option3">朗讀</button>
            <button id="option4">翻譯</button>
            <button id="option5">拼音</button>
        `;
        document.body.appendChild(options);

        const popup = document.createElement("div");
        popup.id = "popup";
        popup.innerHTML = `
            <div><span id="popup-title" style="padding:10px;">pinyin</span><button id="close-popup">X</button></div>
            <div id="popup-content"></div>
        `;
        document.body.appendChild(popup);

        options.querySelector("#option1").addEventListener("click", () => {
            navigator.clipboard.writeText(selectedText).then(() => {
                options.style.display = "none";
            });
        });
        options.querySelector("#option2").addEventListener("click", () => {
            const query = encodeURIComponent(selectedText);
            window.open(`https://www.google.com/search?q=${query}`, '_blank');
        });
        const speaker = new ConsistentLongTextSpeaker();
        options.querySelector("#option3").addEventListener("click", () => {
            speaker.speak(selectedText);
        });
        options.querySelector("#option4").addEventListener("click", () => {
            const query = encodeURIComponent(selectedText);
            window.open(`https://translate.google.com/?sl=auto&tl=zh-TW&op=translate&text=${query}`, '_blank');
        });
        options.querySelector("#option5").addEventListener("click", () => {            
            const popupContent = document.getElementById("popup-content");
            const popupTitle = document.getElementById("popup-title");
            const sentences = selectedText.split(/([。？！；…\n\r]|\,\s*)/g)
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
                pinyinHtml += html(sentence)+"<br>";
            });
            popup.style.display = "block";
            popup.style.top = `${window.event.clientY + 20}px`;
            popup.style.left = `${window.event.clientX + 10}px`;
            popupTitle.textContent = "pinyin";
            popupContent.innerHTML = pinyinHtml;
        });      
        document.getElementById("close-popup").addEventListener("click", () => {
            popup.style.display = "none";
        }); 

        document.addEventListener('selectionchange', () => {
            const selection = shadow.getSelection();
            selectedText = selection.toString().trim();

            // 如果畫面上沒有選取任何文字，立刻隱藏選單與彈窗
            if (selectedText.length === 0) {
                //console.log("沒有選取文字了，隱藏選單與彈窗");
                options.style.display = "none";
                popup.style.display = "none";
            }
        });

        document.addEventListener("mouseup", (e) => {
            // 取得目前選取的 Selection 物件
            const selection = window.getSelection();

            // 將選取內容轉為純文字並去除前後多餘空白
            selectedText = selection.toString().trim();

            if (selectedText.length > 0) {
                //console.log("已選取文字：", selectedText);
                // 顯示自定義選單
                options.style.display = "block";
                const rect = selection.getRangeAt(0).getBoundingClientRect();
                options.style.top = `${rect.top - options.offsetHeight - 10}px`;
                options.style.left = `${rect.left + (rect.width/2) - (options.offsetWidth/2)}px`;
            }
            /*else {
                options.style.display = "none";
                popup.style.display = "none";
            }*/
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
