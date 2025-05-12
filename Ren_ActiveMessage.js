//=============================================================================
// Ren_ActiveMessage.js
// ----------------------------------------------------------------------------
// Copyright (c) 2025 RenTokimiya
// This software is released under the MIT License.
// http://opensource.org/licenses/mit-license.php
// ----------------------------------------------------------------------------
// Version
// 1.0 2025/05/13 初版
// ----------------------------------------------------------------------------
// [X(Twitter)]: https://x.com/StargazerNova1/
//=============================================================================

/*:
 * @target MZ
 * @plugindesc 注釈に書かれたメッセージを自動的に表示します。
 * @author RenTokimiya + ChatGPT(Support)
 * @help Ren_ActiveMessage.js
 * 
 * 以下の形式で書かれている注釈を読み取り、
 * イベントの上部または下部に自動的に表示します。
 * 改行(\n)のみ使用出来ます。
 * 2種類の注釈を同時に採用している場合、
 * それぞれのテキストがそれぞれのタイミングで表示されます。
 * 
 * 近づいた時に表示：
 * <AutoMessage:テキスト>
 * 近づいた時にテキスト1～3の中からランダムに表示：
 * <AutoMessage:<rand:["テキスト1","テキスト2","テキスト3"]>>
 * 設定した秒数毎に表示：
 * <LoopMessage:テキスト, ミリ秒>
 * 設定した秒数毎にテキスト1～3の中からランダムに表示：
 * <LoopMessage:<rand:["テキスト1","テキスト2","テキスト3"]>, ミリ秒>
 * 
 * 書き方例：
 * <LoopMessage:<rand:["こんにちは！\nひさしぶり！","やっほー！","ようこそ！"]>, 300>
 * 
 * 制作にあたり、かめお (Kameo)様のプラグインを参考にさせていただきました。
 * https://ytomy.sakura.ne.jp/tkool/rpgtech/tech_mv/map/map_active_message.html
 * 
 * ［利用規約］
 * このプラグインはMITライセンスで配布しています。
 */

(() => {
    function Window_MapActiveMessage(event, text, duration) {
        text = text.replace(/\\n/g, "\n").replace(/\n/g, "\n");
        this._textLines = text.split(/\n/);
        const tempWindow = new Window_Base(new Rectangle());
        tempWindow.createContents();

        const width = Math.max(
            160,
            Math.max(...this._textLines.map(t => tempWindow.textWidth(t))) + 40
        );
        const height = 36 + this._textLines.length * 36;
        const rect = new Rectangle(0, 0, width, height);
        Window_Base.prototype.initialize.call(this, rect);
        this._event = event;
        this._duration = duration || 150;
        this.refresh();
        this.updatePosition();
    }

    Window_MapActiveMessage.prototype = Object.create(Window_Base.prototype);
    Window_MapActiveMessage.prototype.constructor = Window_MapActiveMessage;

    Window_MapActiveMessage.prototype.update = function () {
        Window_Base.prototype.update.call(this);
        this.updatePosition();
        if (this._duration > 0) {
            this._duration--;
            if (this._duration <= 0) {
                this.parent?.removeChild(this);
            }
        }
    };

    Window_MapActiveMessage.prototype.refresh = function () {
        this.contents.clear();
        for (let i = 0; i < this._textLines.length; i++) {
            this.resetFontSettings();
            this.drawText(this._textLines[i], 0, i * 36, this.contentsWidth(), "left");
        }
    };

    Window_MapActiveMessage.prototype.updatePosition = function () {
        if (!this._event) return;
        this.x = this._event.screenX() - this.width / 2;
        const topY = this._event.screenY() - this.height - 40;
        const bottomY = this._event.screenY() + 40;
        this.y = (topY < 0) ? bottomY : topY;
    };

    window.Window_MapActiveMessage = Window_MapActiveMessage;

    function parseRandomComment(text) {
        const randMatch = text.match(/^<rand:(.+)>$/);
        if (randMatch) {
            try {
                const parsed = JSON.parse(randMatch[1]);
                if (Array.isArray(parsed)) {
                    return parsed[Math.floor(Math.random() * parsed.length)];
                }
            } catch (e) {
                console.warn("ランダムメッセージパース失敗：", e);
            }
        }
        return text;
    }

    Game_Event.prototype.initSimpleMessage = function () {
        const page = this.event().pages[this._pageIndex];
        if (!page) return;
        this._simpleAutoText = null;
        this._simpleLoopText = null;
        this._simpleLoopInterval = 0;
        this._simpleLoopCounter = 0;
        for (const cmd of page.list) {
            if (cmd.code === 108 || cmd.code === 408) {
                const text = cmd.parameters[0];
                const matchAuto = text.match(/<AutoMessage:(.+)>/);
                const matchLoop = text.match(/<LoopMessage:(.+?),\s*(\d+)>/);
                if (matchAuto) {
                    this._simpleAutoText = matchAuto[1].trim();
                    this._simpleAutoShown = false;
                }
                if (matchLoop) {
                    this._simpleLoopText = matchLoop[1].trim();
                    this._simpleLoopInterval = Number(matchLoop[2]);
                    this._simpleLoopCounter = this._simpleLoopInterval;
                }
            }
        }
    };

    const _Game_Event_setupPage = Game_Event.prototype.setupPage;
    Game_Event.prototype.setupPage = function () {
        _Game_Event_setupPage.call(this);
        this.initSimpleMessage();
    };

    const _Game_Event_update = Game_Event.prototype.update;
    Game_Event.prototype.update = function () {
        _Game_Event_update.call(this);

        if (!this._simpleAutoText && !this._simpleLoopText) return;

        if (this._simpleAutoText && !$gameMessage.isBusy()) {
            const dx = Math.abs(this.x - $gamePlayer.x);
            const dy = Math.abs(this.y - $gamePlayer.y);
            const distance = dx + dy;
            if (distance <= 2 && !this._simpleAutoShown) {
                const text = parseRandomComment(this._simpleAutoText);
                const win = new Window_MapActiveMessage(this, text, 100);
                SceneManager._scene.addChild(win);
                this._simpleAutoShown = true;
            } else if (distance > 2) {
                this._simpleAutoShown = false;
            }
        }

        if (this._simpleLoopText && this._simpleLoopInterval > 0 && !$gameMessage.isBusy()) {
            this._simpleLoopCounter--;
            if (this._simpleLoopCounter <= 0) {
                const text = parseRandomComment(this._simpleLoopText);
                const win = new Window_MapActiveMessage(this, text, 100);
                SceneManager._scene.addChild(win);
                this._simpleLoopCounter = this._simpleLoopInterval;
            }
        }
    };
})();
