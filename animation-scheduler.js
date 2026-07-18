/* State-aware requestAnimationFrame scheduler shared by rack components. */
(function initAnimationScheduler(global) {
    "use strict";

    function createAnimationScheduler(options = {}) {
        const doc = options.document || global.document;
        const requestFrame = options.requestFrame || global.requestAnimationFrame.bind(global);
        const cancelFrame = options.cancelFrame || global.cancelAnimationFrame.bind(global);
        const tasks = new Map();
        let frameId = 0;
        let enabled = true;

        function shouldRun(task) {
            if (!task.enabled) return false;
            return task.dirty || task.continuous || (task.isActive && task.isActive());
        }

        function hasRunnableTask() {
            if (!enabled || (doc && doc.hidden)) return false;
            for (const task of tasks.values()) {
                if (shouldRun(task)) return true;
            }
            return false;
        }

        function requestNextFrame() {
            if (!frameId && hasRunnableTask()) frameId = requestFrame(runFrame);
        }

        function runFrame(now) {
            frameId = 0;
            if (!enabled || (doc && doc.hidden)) return;
            for (const task of tasks.values()) {
                if (!shouldRun(task)) continue;
                task.dirty = false;
                task.callback(now);
            }
            requestNextFrame();
        }

        function register(id, callback, taskOptions = {}) {
            if (!id || typeof callback !== "function") throw new TypeError("Animation task id and callback are required");
            if (tasks.has(id)) throw new Error("Animation task already registered: " + id);
            tasks.set(id, {
                callback,
                continuous: Boolean(taskOptions.continuous),
                dirty: taskOptions.dirty !== false,
                enabled: taskOptions.enabled !== false,
                isActive: typeof taskOptions.isActive === "function" ? taskOptions.isActive : null
            });
            requestNextFrame();
            return () => unregister(id);
        }

        function unregister(id) {
            tasks.delete(id);
            if (!hasRunnableTask() && frameId) {
                cancelFrame(frameId);
                frameId = 0;
            }
        }

        function invalidate(id) {
            const task = tasks.get(id);
            if (!task) return false;
            task.dirty = true;
            requestNextFrame();
            return true;
        }

        function setTaskEnabled(id, value) {
            const task = tasks.get(id);
            if (!task) return false;
            task.enabled = Boolean(value);
            if (task.enabled) task.dirty = true;
            requestNextFrame();
            return true;
        }

        function setEnabled(value) {
            enabled = Boolean(value);
            if (!enabled && frameId) {
                cancelFrame(frameId);
                frameId = 0;
            } else if (enabled) {
                requestNextFrame();
            }
        }

        function handleVisibility() {
            if (doc && doc.hidden) {
                if (frameId) cancelFrame(frameId);
                frameId = 0;
                return;
            }
            for (const task of tasks.values()) task.dirty = true;
            requestNextFrame();
        }

        if (doc && typeof doc.addEventListener === "function") {
            doc.addEventListener("visibilitychange", handleVisibility);
        }

        return Object.freeze({
            register,
            unregister,
            invalidate,
            setTaskEnabled,
            setEnabled,
            isRunning() { return Boolean(frameId); },
            taskCount() { return tasks.size; },
            dispose() {
                setEnabled(false);
                tasks.clear();
                if (doc && typeof doc.removeEventListener === "function") {
                    doc.removeEventListener("visibilitychange", handleVisibility);
                }
            }
        });
    }

    global.MFA = global.MFA || {};
    global.MFA.createAnimationScheduler = createAnimationScheduler;
    global.MFA.animationScheduler = createAnimationScheduler();
})(window);
