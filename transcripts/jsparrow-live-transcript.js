
/**
 * JSparrowLiveTranscript
 * Browser-based live speech transcription using Web Speech API.
 *
 * Note: Web Speech API support and behavior depend on the browser.
 */
class JSparrowLiveTranscript {
  constructor(options = {}) {
    this.userId = options.userId || crypto.randomUUID();
    this.userName = options.userName || "Guest";
    this.speakerId = options.speakerId || this.userId;
    this.language = options.language || "en-IN";

    this.continuous = options.continuous !== false;
    this.interimResults = options.interimResults !== false;
    this.maxAlternatives = options.maxAlternatives || 1;
    this.autoRestart = options.autoRestart !== false;

    this.onUpdate = options.onUpdate || (() => {});
    this.onSegment = options.onSegment || (() => {});
    this.onStatusChange = options.onStatusChange || (() => {});
    this.onError = options.onError || (() => {});

    this.transcript = [];
    this.interimText = "";
    this.status = "idle";
    this.lastError = null;

    this.recognition = null;
    this.destroyed = false;
    this.wantListening = false;
    this.paused = false;
    this.startedAt = null;

    this._sessionNumber = 0;
    this._finalizedIndexes = new Set();
    this._restartTimer = null;
    this._generation = 0;

    const SpeechRecognition =
      typeof window !== "undefined"
        ? window.SpeechRecognition ||
          window.webkitSpeechRecognition
        : null;

    this.supported = Boolean(SpeechRecognition);
    this._SpeechRecognition = SpeechRecognition;

    if (!this.supported) {
      this._setStatus("unsupported");
      this._reportError(
        "unsupported",
        "This browser does not support the Web Speech API."
      );
      return;
    }

    this._createRecognition();
  }

  _createRecognition() {
    const recognition = new this._SpeechRecognition();

    recognition.lang = this.language;
    recognition.continuous = this.continuous;
    recognition.interimResults = this.interimResults;
    recognition.maxAlternatives = this.maxAlternatives;

    const session = ++this._sessionNumber;
    this._finalizedIndexes = new Set();

    recognition.onstart = () => {
      if (this.destroyed || recognition !== this.recognition) return;

      this.lastError = null;
      this._setStatus("listening");
    };

    recognition.onresult = (event) => {
      if (this.destroyed || recognition !== this.recognition) return;

      let latestInterim = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const alternative = result[0];

        if (!alternative) continue;

        const text = alternative.transcript.trim();
        if (!text) continue;

        if (result.isFinal) {
          // Final result indexes must only be accepted once per session.
          const key = `${session}:${i}`;

          if (this._finalizedIndexes.has(key)) continue;
          this._finalizedIndexes.add(key);

          const segment = {
            id: crypto.randomUUID(),
            userId: this.userId,
            userName: this.userName,
            speakerId: this.speakerId,
            text,
            timestamp: new Date().toISOString(),
            elapsedMs: this.startedAt
              ? Math.max(0, Date.now() - this.startedAt)
              : 0,
            confidence:
              Number.isFinite(alternative.confidence)
                ? alternative.confidence
                : null,
            isFinal: true,
            language: this.language
          };

          this.transcript.push(segment);

          // Each callback is isolated so an application callback
          // cannot break the recognition event handler.
          this._safeCallback(this.onSegment, segment);
        } else {
          latestInterim += (latestInterim ? " " : "") + text;
        }
      }

      this.interimText = latestInterim;
      this._notifyUpdate();
    };

    recognition.onerror = (event) => {
      if (this.destroyed || recognition !== this.recognition) return;

      const error = {
        code: event.error || "unknown",
        message: this._friendlyError(event.error),
        originalEvent: event
      };

      this.lastError = error;
      this._safeCallback(this.onError, error);

      // Some errors are recoverable; others should stop retries.
      const terminalErrors = new Set([
        "not-allowed",
        "service-not-allowed",
        "audio-capture",
        "language-not-supported"
      ]);

      if (terminalErrors.has(event.error)) {
        this.wantListening = false;
        this.paused = false;
        this._clearRestartTimer();
        this._setStatus("stopped");
      }
    };

    recognition.onend = () => {
      if (this.destroyed || recognition !== this.recognition) return;

      this.interimText = "";
      this._notifyUpdate();

      if (!this.wantListening || this.paused) {
        return;
      }

      if (this.autoRestart) {
        this._scheduleRestart();
      } else {
        this.wantListening = false;
        this._setStatus("stopped");
      }
    };

    this.recognition = recognition;
  }

  _friendlyError(code) {
    const messages = {
      "not-allowed":
        "Microphone permission was denied. Allow microphone access in browser settings.",
      "service-not-allowed":
        "The browser's speech recognition service is not allowed.",
      "audio-capture":
        "No usable microphone was found. Check your microphone connection.",
      "network":
        "Speech recognition encountered a network error. Check your connection.",
      "language-not-supported":
        `The recognition service does not support ${this.language}.`,
      "no-speech":
        "No speech was detected. Try speaking closer to the microphone.",
      "aborted":
        "Speech recognition was interrupted.",
      "bad-grammar":
        "The speech recognition service rejected its grammar configuration.",
      "phrases-not-supported":
        "The speech recognition service does not support one or more configured phrases."
    };

    return messages[code] || `Speech recognition error: ${code || "unknown"}.`;
  }

  _safeCallback(callback, value) {
    try {
      callback(value);
    } catch (error) {
      console.error("JSparrow callback error:", error);
    }
  }

  _setStatus(status) {
    if (this.status === status) return;

    this.status = status;
    this._safeCallback(this.onStatusChange, status);
    this._notifyUpdate();
  }

  _notifyUpdate() {
    this._safeCallback(this.onUpdate, this.getSnapshot());
  }

  _reportError(code, message) {
    const error = { code, message };
    this.lastError = error;
    this._safeCallback(this.onError, error);
  }

  _clearRestartTimer() {
    if (this._restartTimer !== null) {
      clearTimeout(this._restartTimer);
      this._restartTimer = null;
    }
  }

  _scheduleRestart() {
    this._clearRestartTimer();

    const generation = this._generation;

    this._restartTimer = setTimeout(() => {
      this._restartTimer = null;

      if (
        this.destroyed ||
        !this.wantListening ||
        this.paused ||
        generation !== this._generation
      ) {
        return;
      }

      try {
        // A new instance starts a clean recognition session.
        this._createRecognition();
        this.recognition.start();
      } catch (error) {
        // InvalidStateError commonly means recognition is already active.
        if (error.name !== "InvalidStateError") {
          this._reportError(
            "restart-failed",
            error.message || "Could not restart speech recognition."
          );
          this._setStatus("stopped");
        }
      }
    }, 300);
  }

  async start() {
    if (this.destroyed) {
      throw new Error("This transcription instance has been destroyed.");
    }

    if (!this.supported) {
      this._setStatus("unsupported");
      return false;
    }

    if (this.status === "listening" && this.wantListening) return true;

    this._clearRestartTimer();
    this._generation++;
    this.wantListening = true;
    this.paused = false;
    this.startedAt ??= Date.now();

    // start() must be called following a user gesture in the UI.
    try {
      if (!this.recognition) this._createRecognition();

      this.recognition.lang = this.language;
      this.recognition.start();

      return true;
    } catch (error) {
      if (error.name === "InvalidStateError") {
        // The browser may still be transitioning between sessions.
        this._scheduleRestart();
        return true;
      }

      this.wantListening = false;

      const code =
        error.name === "NotAllowedError"
          ? "not-allowed"
          : "start-failed";

      this._reportError(
        code,
        error.name === "NotAllowedError"
          ? "Microphone permission was denied. Allow access and try again."
          : error.message || "Could not start speech recognition."
      );

      this._setStatus("stopped");
      return false;
    }
  }

  pause() {
    if (!this.supported || this.destroyed || !this.wantListening) {
      return false;
    }

    this.paused = true;
    this._clearRestartTimer();

    try {
      this.recognition?.stop();
    } catch (_) {
      // The recognition session may already have ended.
    }

    this.interimText = "";
    this._setStatus("paused");
    this._notifyUpdate();
    return true;
  }

  async resume() {
    if (!this.supported || this.destroyed) return false;

    this.paused = false;
    this.wantListening = true;
    this._clearRestartTimer();
    this._generation++;

    try {
      // A fresh instance avoids restarting an ended recognition object.
      this._createRecognition();
      this.recognition.start();
      return true;
    } catch (error) {
      if (error.name === "InvalidStateError") {
        this._scheduleRestart();
        return true;
      }

      this._reportError(
        "resume-failed",
        error.message || "Could not resume speech recognition."
      );
      return false;
    }
  }

  stop() {
    // Explicit stop disables automatic restart first.
    this.wantListening = false;
    this.paused = false;
    this._generation++;
    this._clearRestartTimer();
    this.interimText = "";

    try {
      this.recognition?.stop();
    } catch (_) {
      // It may already be stopped.
    }

    this._setStatus("stopped");
    this._notifyUpdate();
  }

  setLanguage(language) {
    if (!language || typeof language !== "string") {
      throw new TypeError("A valid BCP-47 language tag is required.");
    }

    const wasListening = this.wantListening && !this.paused;

    this.language = language;
    this._generation++;
    this._clearRestartTimer();

    if (wasListening) {
      this.wantListening = false;

      try {
        this.recognition?.abort();
      } catch (_) {}

      this._createRecognition();
      this.wantListening = true;
      this.paused = false;

      return this.start();
    }

    if (this.recognition) {
      this.recognition.lang = language;
    }

    this._notifyUpdate();
    return true;
  }

  clearTranscript() {
    this.transcript = [];
    this.interimText = "";
    this._notifyUpdate();
  }

  getSnapshot() {
    return {
      userId: this.userId,
      userName: this.userName,
      speakerId: this.speakerId,
      language: this.language,
      status: this.status,
      interimText: this.interimText,
      transcript: this.transcript.map(segment => ({ ...segment })),
      lastError: this.lastError
    };
  }

  exportJSON() {
    return JSON.stringify(
      {
        application: "JSparrow",
        exportedAt: new Date().toISOString(),
        userId: this.userId,
        userName: this.userName,
        speakerId: this.speakerId,
        language: this.language,
        segments: this.transcript
      },
      null,
      2
    );
  }

  exportTXT() {
    return this.transcript
      .map(segment => {
        const time = new Date(segment.timestamp).toLocaleTimeString();
        return `[${time}] ${segment.userName}: ${segment.text}`;
      })
      .join("\n");
  }

  download(filename, content, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();

    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  downloadJSON() {
    this.download(
      "jsparrow-transcript.json",
      this.exportJSON(),
      "application/json;charset=utf-8"
    );
  }

  downloadTXT() {
    this.download(
      "jsparrow-transcript.txt",
      this.exportTXT(),
      "text/plain;charset=utf-8"
    );
  }

  destroy() {
    this.wantListening = false;
    this.paused = false;
    this.destroyed = true;
    this._generation++;
    this._clearRestartTimer();

    if (this.recognition) {
      this.recognition.onstart = null;
      this.recognition.onresult = null;
      this.recognition.onerror = null;
      this.recognition.onend = null;

      try {
        this.recognition.abort();
      } catch (_) {}

      this.recognition = null;
    }

    this.interimText = "";
    this._setStatus("stopped");
  }
}

// Export for ES modules and browser script usage.
if (typeof module !== "undefined" && module.exports) {
  module.exports = { JSparrowLiveTranscript };
}

if (typeof window !== "undefined") {
  window.JSparrowLiveTranscript = JSparrowLiveTranscript;
}
