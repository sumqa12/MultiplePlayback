// アイコンはPWAでのオフライン動作を考慮し、外部リソースを使わずインラインSVGで持つ
function icon(inner) {
    return `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${inner}</svg>`;
}
const ICON_PLAY = icon('<path d="M8 5l11 7-11 7z"/>');
const ICON_PAUSE = icon('<path d="M7 5h3.5v14H7zm6.5 0H17v14h-3.5z"/>');
const ICON_LOOP = icon('<path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z"/>');
const ICON_VOLUME = icon('<path d="M3 9h4l5-4v14l-5-4H3V9z"/>' +
    '<path d="M15.5 8.8a4.5 4.5 0 0 1 0 6.4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>' +
    '<path d="M18.3 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>');
const ICON_MUTE = icon('<path d="M3 9h4l5-4v14l-5-4H3V9z"/>' +
    '<path d="M16 9.5l5 5m0-5l-5 5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>');
const ICON_FILE = icon('<path d="M12 3v10.6A3.5 3.5 0 1 0 14 17V7h4V3h-6z"/>');
const ICON_REMOVE = icon('<path d="M6.4 5L5 6.4 10.6 12 5 17.6 6.4 19 12 13.4 17.6 19 19 17.6 13.4 12 19 6.4 17.6 5 12 10.6z"/>');
const NO_TIME = '--:--';
// 秒数を m:ss / h:mm:ss 形式に変換する
function formatTime(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) {
        return NO_TIME;
    }
    const total = Math.floor(seconds);
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    if (h > 0) {
        return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }
    return `${m}:${String(s).padStart(2, '0')}`;
}
class Player {
    audio;
    element;
    fileInput;
    fileButton;
    playButton;
    titleLabel;
    seekInput;
    bufferedBar;
    currentTimeLabel;
    durationLabel;
    loopButton;
    muteButton;
    volumeInput;
    removeButton;
    objectUrl = null;
    // シーク操作中はtimeupdateでつまみを動かさない
    isSeeking = false;
    constructor(container, options = {}) {
        this.audio = document.createElement('audio');
        // controls属性は使わず、独自UIから操作する
        this.audio.preload = 'metadata';
        this.element = document.createElement('div');
        this.element.className = 'audio-player is-empty';
        this.element.appendChild(this.audio);
        this.fileInput = document.createElement('input');
        this.fileInput.type = 'file';
        this.fileInput.accept = 'audio/*';
        this.fileInput.className = 'audio-player__file-input';
        this.element.appendChild(this.fileInput);
        this.fileButton = this.createIconButton('audio-player__file', ICON_FILE, '音声ファイルを選択');
        this.playButton = this.createIconButton('audio-player__play', ICON_PLAY, '再生');
        this.playButton.disabled = true;
        const body = document.createElement('div');
        body.className = 'audio-player__body';
        this.titleLabel = document.createElement('span');
        this.titleLabel.className = 'audio-player__title';
        this.titleLabel.textContent = '音声ファイルを選択してください';
        body.appendChild(this.titleLabel);
        const seekWrapper = document.createElement('div');
        seekWrapper.className = 'audio-player__seek';
        this.bufferedBar = document.createElement('div');
        this.bufferedBar.className = 'audio-player__buffered';
        seekWrapper.appendChild(this.bufferedBar);
        this.seekInput = document.createElement('input');
        this.seekInput.type = 'range';
        this.seekInput.className = 'audio-player__seek-input';
        this.seekInput.min = '0';
        this.seekInput.max = '0';
        this.seekInput.step = '0.01';
        this.seekInput.value = '0';
        this.seekInput.disabled = true;
        this.seekInput.setAttribute('aria-label', '再生位置');
        seekWrapper.appendChild(this.seekInput);
        body.appendChild(seekWrapper);
        const time = document.createElement('div');
        time.className = 'audio-player__time';
        this.currentTimeLabel = document.createElement('span');
        this.currentTimeLabel.textContent = '0:00';
        this.durationLabel = document.createElement('span');
        this.durationLabel.textContent = NO_TIME;
        time.append(this.currentTimeLabel, document.createTextNode(' / '), this.durationLabel);
        body.appendChild(time);
        this.loopButton = this.createIconButton('audio-player__loop', ICON_LOOP, '繰り返し再生');
        this.loopButton.setAttribute('aria-pressed', 'false');
        this.muteButton = this.createIconButton('audio-player__mute', ICON_VOLUME, 'ミュート');
        this.muteButton.setAttribute('aria-pressed', 'false');
        this.volumeInput = document.createElement('input');
        this.volumeInput.type = 'range';
        this.volumeInput.className = 'audio-player__volume';
        this.volumeInput.min = '0';
        this.volumeInput.max = '1';
        this.volumeInput.step = '0.01';
        this.volumeInput.value = '1';
        this.volumeInput.setAttribute('aria-label', '音量');
        this.volumeInput.style.setProperty('--progress', '100%');
        this.removeButton = this.createIconButton('audio-player__remove', ICON_REMOVE, 'この音声を削除');
        this.element.append(this.fileButton, this.playButton, body, this.loopButton, this.muteButton, this.volumeInput, this.removeButton);
        this.bindEvents(options);
        container.appendChild(this.element);
    }
    createIconButton(className, svg, label) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = `audio-player__button ${className}`;
        button.innerHTML = svg;
        button.title = label;
        button.setAttribute('aria-label', label);
        return button;
    }
    bindEvents(options) {
        // ファイル選択
        this.fileButton.addEventListener('click', () => this.fileInput.click());
        this.fileInput.addEventListener('change', () => {
            const file = this.fileInput.files?.[0];
            if (file) {
                this.setAudioSource(file);
            }
        });
        // 再生 / 一時停止
        this.playButton.addEventListener('click', () => this.toggle());
        // 繰り返し再生
        this.loopButton.addEventListener('click', () => {
            this.setLoop(!this.audio.loop);
        });
        // ミュート
        this.muteButton.addEventListener('click', () => {
            this.audio.muted = !this.audio.muted;
        });
        // 音量
        this.volumeInput.addEventListener('input', () => {
            const volume = Number(this.volumeInput.value);
            this.audio.volume = volume;
            // スライダーを動かしたらミュートは解除する
            this.audio.muted = volume === 0;
        });
        // シーク
        this.seekInput.addEventListener('pointerdown', () => {
            this.isSeeking = true;
        });
        this.seekInput.addEventListener('keydown', () => {
            this.isSeeking = true;
        });
        this.seekInput.addEventListener('input', () => {
            const time = Number(this.seekInput.value);
            this.updateSeekFill(time);
            this.currentTimeLabel.textContent = formatTime(time);
            if (Number.isFinite(this.audio.duration)) {
                this.audio.currentTime = time;
            }
        });
        const endSeek = () => {
            this.isSeeking = false;
        };
        this.seekInput.addEventListener('pointerup', endSeek);
        this.seekInput.addEventListener('pointercancel', endSeek);
        this.seekInput.addEventListener('keyup', endSeek);
        this.seekInput.addEventListener('blur', endSeek);
        // 削除
        this.removeButton.addEventListener('click', () => {
            options.onRemove?.(this);
            this.destroy();
        });
        // audio要素の状態をUIへ反映
        this.audio.addEventListener('loadedmetadata', () => this.syncDuration());
        this.audio.addEventListener('durationchange', () => this.syncDuration());
        this.audio.addEventListener('timeupdate', () => this.syncCurrentTime());
        this.audio.addEventListener('progress', () => this.syncBuffered());
        this.audio.addEventListener('play', () => this.syncPlayState());
        this.audio.addEventListener('pause', () => this.syncPlayState());
        this.audio.addEventListener('ended', () => this.syncPlayState());
        this.audio.addEventListener('volumechange', () => this.syncVolume());
        this.audio.addEventListener('waiting', () => this.element.classList.add('is-loading'));
        this.audio.addEventListener('playing', () => this.element.classList.remove('is-loading'));
        this.audio.addEventListener('canplay', () => this.element.classList.remove('is-loading'));
        this.audio.addEventListener('error', () => {
            this.element.classList.remove('is-loading');
            this.element.classList.add('has-error');
            this.titleLabel.textContent = 'この音声ファイルは再生できません';
        });
    }
    syncDuration() {
        const duration = this.audio.duration;
        this.durationLabel.textContent = formatTime(duration);
        if (Number.isFinite(duration) && duration > 0) {
            this.seekInput.max = String(duration);
            this.seekInput.disabled = false;
        }
        else {
            // ライブストリーム等、長さが確定しない場合はシーク不可
            this.seekInput.max = '0';
            this.seekInput.disabled = true;
        }
        this.updateSeekFill(this.audio.currentTime);
    }
    syncCurrentTime() {
        this.currentTimeLabel.textContent = formatTime(this.audio.currentTime);
        if (this.isSeeking) {
            return;
        }
        this.seekInput.value = String(this.audio.currentTime);
        this.updateSeekFill(this.audio.currentTime);
    }
    syncBuffered() {
        const duration = this.audio.duration;
        const buffered = this.audio.buffered;
        if (!Number.isFinite(duration) || duration <= 0 || buffered.length === 0) {
            this.bufferedBar.style.width = '0%';
            return;
        }
        // 現在位置を含む範囲の終端までをバッファ済みとして表示する
        let end = 0;
        for (let i = 0; i < buffered.length; i++) {
            if (buffered.start(i) <= this.audio.currentTime) {
                end = Math.max(end, buffered.end(i));
            }
        }
        this.bufferedBar.style.width = `${(end / duration) * 100}%`;
    }
    syncPlayState() {
        const playing = !this.audio.paused && !this.audio.ended;
        this.element.classList.toggle('is-playing', playing);
        this.playButton.innerHTML = playing ? ICON_PAUSE : ICON_PLAY;
        const label = playing ? '一時停止' : '再生';
        this.playButton.title = label;
        this.playButton.setAttribute('aria-label', label);
    }
    syncVolume() {
        const muted = this.audio.muted || this.audio.volume === 0;
        this.element.classList.toggle('is-muted', muted);
        this.muteButton.innerHTML = muted ? ICON_MUTE : ICON_VOLUME;
        this.muteButton.setAttribute('aria-pressed', String(muted));
        const label = muted ? 'ミュート解除' : 'ミュート';
        this.muteButton.title = label;
        this.muteButton.setAttribute('aria-label', label);
        this.volumeInput.value = String(this.audio.volume);
        this.volumeInput.style.setProperty('--progress', `${(muted ? 0 : this.audio.volume) * 100}%`);
    }
    updateSeekFill(time) {
        const duration = this.audio.duration;
        const ratio = Number.isFinite(duration) && duration > 0 ? time / duration : 0;
        this.seekInput.style.setProperty('--progress', `${ratio * 100}%`);
    }
    setAudioSource(audioFile) {
        // 直前のオブジェクトURLを解放してからsrcを差し替える
        this.releaseObjectUrl();
        this.objectUrl = URL.createObjectURL(audioFile);
        this.audio.src = this.objectUrl;
        this.audio.load();
        this.titleLabel.textContent = audioFile.name;
        this.titleLabel.title = audioFile.name;
        this.playButton.disabled = false;
        this.element.classList.remove('is-empty', 'has-error');
        this.currentTimeLabel.textContent = '0:00';
        this.durationLabel.textContent = NO_TIME;
        this.seekInput.value = '0';
        this.updateSeekFill(0);
    }
    hasAudio() {
        return this.audio.src !== '';
    }
    play() {
        // 自動再生ポリシー等で失敗することがあるため握り潰さない
        this.audio.play().catch((error) => {
            console.warn('再生できませんでした', error);
        });
    }
    pause() {
        this.audio.pause();
    }
    toggle() {
        if (this.audio.paused) {
            this.play();
        }
        else {
            this.pause();
        }
    }
    stop() {
        this.audio.pause();
        this.audio.currentTime = 0;
    }
    setLoop(loop) {
        this.audio.loop = loop;
        this.element.classList.toggle('is-loop', loop);
        this.loopButton.setAttribute('aria-pressed', String(loop));
        const label = loop ? '繰り返し再生を解除' : '繰り返し再生';
        this.loopButton.title = label;
        this.loopButton.setAttribute('aria-label', label);
    }
    get loop() {
        return this.audio.loop;
    }
    set volume(value) {
        this.audio.volume = Math.min(1, Math.max(0, value));
    }
    get volume() {
        return this.audio.volume;
    }
    get isPlaying() {
        return !this.audio.paused && !this.audio.ended;
    }
    releaseObjectUrl() {
        if (this.objectUrl) {
            URL.revokeObjectURL(this.objectUrl);
            this.objectUrl = null;
        }
    }
    destroy() {
        this.audio.pause();
        this.audio.removeAttribute('src');
        this.audio.load();
        this.releaseObjectUrl();
        this.element.remove();
    }
}
export default Player;
