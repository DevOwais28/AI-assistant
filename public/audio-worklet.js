// public/audio-worklet.js
class AudioCaptureProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    this.bufferSize = options.processorOptions.bufferSize || 1024;
    this.buffer = new Float32Array(this.bufferSize);
    this.bytesWritten = 0;
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    if (!input || !input[0]) return true;

    const channelData = input[0];
    
    for (let i = 0; i < channelData.length; i++) {
      this.buffer[this.bytesWritten++] = channelData[i];
      
      if (this.bytesWritten >= this.bufferSize) {
        let sum = 0;
        for (let j = 0; j < this.bufferSize; j++) {
          sum += this.buffer[j] * this.buffer[j];
        }
        const rms = Math.sqrt(sum / this.bufferSize);
        
        this.port.postMessage({
          type: 'audio',
          data: this.buffer.slice(),
          rms: rms
        });
        this.bytesWritten = 0;
      }
    }
    return true;
  }
}

registerProcessor('audio-capture', AudioCaptureProcessor);