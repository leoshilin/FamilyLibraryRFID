// utils/eventBus.js

const listeners = {}

function on(eventName, callback) {
  if (!listeners[eventName]) {
    listeners[eventName] = []
  }
  listeners[eventName].push(callback)
}

function emit(eventName, payload) {
  if (!listeners[eventName]) return
  listeners[eventName].forEach(cb => cb(payload))
}

function off(eventName, callback) {
  if (!listeners[eventName]) return
  listeners[eventName] = listeners[eventName].filter(cb => cb !== callback)
}

module.exports = {
  on,
  emit,
  off
}