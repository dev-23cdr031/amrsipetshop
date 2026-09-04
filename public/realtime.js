/* ═══════════════════════════════════════════════════════════
   AM SRI — Realtime client (Server-Sent Events)
   Shared helper for Admin Dashboard + Order Tracking pages.
   No dependencies — uses the native EventSource API.
   ═══════════════════════════════════════════════════════════ */
(function (global) {
    "use strict";

    function Realtime(options) {
        options = options || {};
        this.channel = options.channel || "global"; // "admin" | "order"
        this.orderId = options.orderId || null;
        this.handlers = {};
        this.es = null;
        this.reconnectTimer = null;
        this.reconnectAttempts = 0;
        this.connected = false;
        this.onStatus = options.onStatus || function () {};
    }

    Realtime.prototype.connect = function () {
        var self = this;
        var url = "/api/events?channel=" + encodeURIComponent(this.channel);
        if (this.orderId) url += "&orderId=" + encodeURIComponent(this.orderId);

        // EventSource is natively available in all modern browsers
        if (typeof EventSource === "undefined") {
            this.onStatus(false, "unsupported");
            return;
        }

        try {
            this.es = new EventSource(url);
        } catch (e) {
            this.onStatus(false, "error");
            return;
        }

        this.es.onopen = function () {
            self.connected = true;
            self.reconnectAttempts = 0;
            self.onStatus(true, "connected");
        };

        this.es.onerror = function () {
            self.connected = false;
            self.onStatus(false, "disconnected");
            if (self.es) { try { self.es.close(); } catch (e) {} self.es = null; }
            // Auto-reconnect with a capped number of attempts (e.g. Vercel
            // serverless does not support long-lived SSE connections).
            self.reconnectAttempts = (self.reconnectAttempts || 0) + 1;
            if (self.reconnectAttempts > 3) {
                self.onStatus(false, "realtime-unavailable");
                return;
            }
            if (self.reconnectTimer) clearTimeout(self.reconnectTimer);
            self.reconnectTimer = setTimeout(function () { self.connect(); }, 3000);
        };

        // Listen for typed server events
        this.es.addEventListener("order:new", function (ev) {
            self._dispatch("order:new", ev);
        });
        this.es.addEventListener("order:status", function (ev) {
            self._dispatch("order:status", ev);
        });
        this.es.addEventListener("heartbeat", function () {
            self.onStatus(true, "alive");
        });
    };

    Realtime.prototype._dispatch = function (type, ev) {
        var payload = {};
        try { payload = JSON.parse(ev.data); } catch (e) { payload = {}; }
        var fns = this.handlers[type];
        if (fns) { for (var i = 0; i < fns.length; i++) { try { fns[i](payload); } catch (e) {} } }
    };

    Realtime.prototype.on = function (type, fn) {
        if (!this.handlers[type]) this.handlers[type] = [];
        this.handlers[type].push(fn);
        return this;
    };

    Realtime.prototype.disconnect = function () {
        if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }
        if (this.es) { try { this.es.close(); } catch (e) {} this.es = null; }
        this.connected = false;
    };

    global.Realtime = Realtime;
})(window);
