/**
 * Procedural Ambient Sound Engine
 * Generates calming sounds using Web Audio API — no audio files needed
 */

class AmbientSoundEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.activeNodes = [];
    this.currentSound = null;
    this.isPlaying = false;
  }

  init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0;
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  // Create a noise buffer
  createNoiseBuffer(type = 'white', duration = 2) {
    const sampleRate = this.ctx.sampleRate;
    const length = sampleRate * duration;
    const buffer = this.ctx.createBuffer(2, length, sampleRate);
    
    for (let ch = 0; ch < 2; ch++) {
      const data = buffer.getChannelData(ch);
      let lastOut = 0;
      
      for (let i = 0; i < length; i++) {
        const white = Math.random() * 2 - 1;
        
        if (type === 'white') {
          data[i] = white * 0.3;
        } else if (type === 'pink') {
          // Simple pink noise approximation
          lastOut = 0.99886 * lastOut + white * 0.0555179;
          data[i] = lastOut * 0.5;
        } else if (type === 'brown') {
          lastOut = (lastOut + (0.02 * white)) / 1.02;
          data[i] = lastOut * 3.5;
        }
      }
    }
    return buffer;
  }

  // Stop all active nodes smoothly
  stopAll(fadeTime = 1.5) {
    return new Promise(resolve => {
      if (this.masterGain) {
        this.masterGain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + fadeTime);
      }
      setTimeout(() => {
        this.activeNodes.forEach(node => {
          // A node already stopped or disconnected throws; either way it is done with.
          try { node.stop?.(); } catch { /* already stopped */ }
          try { node.disconnect?.(); } catch { /* already disconnected */ }
        });
        this.activeNodes = [];
        this.isPlaying = false;
        this.currentSound = null;
        resolve();
      }, fadeTime * 1000);
    });
  }

  // Fade in
  fadeIn(volume = 0.6, fadeTime = 2) {
    if (this.masterGain) {
      this.masterGain.gain.linearRampToValueAtTime(volume, this.ctx.currentTime + fadeTime);
    }
  }

  // ─── Sound Generators ───

  playRain() {
    this.init();
    
    // Base rain (filtered white noise)
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.createNoiseBuffer('white', 4);
    noise.loop = true;
    
    const lpf = this.ctx.createBiquadFilter();
    lpf.type = 'lowpass';
    lpf.frequency.value = 3000;
    
    const hpf = this.ctx.createBiquadFilter();
    hpf.type = 'highpass';
    hpf.frequency.value = 200;
    
    noise.connect(lpf).connect(hpf).connect(this.masterGain);
    noise.start();
    this.activeNodes.push(noise);

    // Rain drops (random clicks)
    const dropInterval = setInterval(() => {
      if (!this.isPlaying || this.currentSound !== 'rain') {
        clearInterval(dropInterval);
        return;
      }
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.frequency.value = 2000 + Math.random() * 4000;
      gain.gain.setValueAtTime(0.02, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.05);
      osc.connect(gain).connect(this.masterGain);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.05);
    }, 30 + Math.random() * 60);

    this.isPlaying = true;
    this.currentSound = 'rain';
    this.fadeIn(0.5);
  }

  playOcean() {
    this.init();
    
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.createNoiseBuffer('brown', 4);
    noise.loop = true;
    
    const lpf = this.ctx.createBiquadFilter();
    lpf.type = 'lowpass';
    lpf.frequency.value = 800;
    
    // LFO for wave effect
    const lfo = this.ctx.createOscillator();
    const lfoGain = this.ctx.createGain();
    lfo.frequency.value = 0.08; // Slow waves
    lfo.type = 'sine';
    lfoGain.gain.value = 400;
    lfo.connect(lfoGain).connect(lpf.frequency);
    lfo.start();
    
    noise.connect(lpf).connect(this.masterGain);
    noise.start();
    this.activeNodes.push(noise, lfo);
    
    this.isPlaying = true;
    this.currentSound = 'ocean';
    this.fadeIn(0.6);
  }

  playThunder() {
    this.init();
    
    // Rain base
    const rain = this.ctx.createBufferSource();
    rain.buffer = this.createNoiseBuffer('white', 4);
    rain.loop = true;
    
    const lpf = this.ctx.createBiquadFilter();
    lpf.type = 'lowpass';
    lpf.frequency.value = 2500;
    
    const rainGain = this.ctx.createGain();
    rainGain.gain.value = 0.7;
    
    rain.connect(lpf).connect(rainGain).connect(this.masterGain);
    rain.start();
    this.activeNodes.push(rain);
    
    // Thunder rumbles at random intervals
    const thunderInterval = setInterval(() => {
      if (!this.isPlaying || this.currentSound !== 'thunder') {
        clearInterval(thunderInterval);
        return;
      }
      const thunder = this.ctx.createBufferSource();
      thunder.buffer = this.createNoiseBuffer('brown', 3);
      const tGain = this.ctx.createGain();
      const tFilter = this.ctx.createBiquadFilter();
      tFilter.type = 'lowpass';
      tFilter.frequency.value = 150;
      
      tGain.gain.setValueAtTime(0, this.ctx.currentTime);
      tGain.gain.linearRampToValueAtTime(0.8, this.ctx.currentTime + 0.1);
      tGain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 2.5);
      
      thunder.connect(tFilter).connect(tGain).connect(this.masterGain);
      thunder.start();
      thunder.stop(this.ctx.currentTime + 3);
    }, 5000 + Math.random() * 10000);
    
    this.isPlaying = true;
    this.currentSound = 'thunder';
    this.fadeIn(0.5);
  }

  playFireplace() {
    this.init();
    
    // Base crackle
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.createNoiseBuffer('brown', 4);
    noise.loop = true;
    
    const bpf = this.ctx.createBiquadFilter();
    bpf.type = 'bandpass';
    bpf.frequency.value = 600;
    bpf.Q.value = 0.5;
    
    noise.connect(bpf).connect(this.masterGain);
    noise.start();
    this.activeNodes.push(noise);
    
    // Crackle pops
    const crackleInterval = setInterval(() => {
      if (!this.isPlaying || this.currentSound !== 'fireplace') {
        clearInterval(crackleInterval);
        return;
      }
      const pop = this.ctx.createOscillator();
      const popGain = this.ctx.createGain();
      pop.frequency.value = 200 + Math.random() * 800;
      pop.type = 'sawtooth';
      popGain.gain.setValueAtTime(0.08, this.ctx.currentTime);
      popGain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.02 + Math.random() * 0.03);
      pop.connect(popGain).connect(this.masterGain);
      pop.start();
      pop.stop(this.ctx.currentTime + 0.05);
    }, 100 + Math.random() * 300);
    
    this.isPlaying = true;
    this.currentSound = 'fireplace';
    this.fadeIn(0.5);
  }

  playWhiteNoise() {
    this.init();
    
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.createNoiseBuffer('white', 4);
    noise.loop = true;
    
    const lpf = this.ctx.createBiquadFilter();
    lpf.type = 'lowpass';
    lpf.frequency.value = 8000;
    
    noise.connect(lpf).connect(this.masterGain);
    noise.start();
    this.activeNodes.push(noise);
    
    this.isPlaying = true;
    this.currentSound = 'whitenoise';
    this.fadeIn(0.35);
  }

  playStream() {
    this.init();
    
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.createNoiseBuffer('pink', 4);
    noise.loop = true;
    
    const lpf = this.ctx.createBiquadFilter();
    lpf.type = 'lowpass';
    lpf.frequency.value = 2000;
    
    const hpf = this.ctx.createBiquadFilter();
    hpf.type = 'highpass';
    hpf.frequency.value = 400;
    
    // Gentle modulation
    const lfo = this.ctx.createOscillator();
    const lfoGain = this.ctx.createGain();
    lfo.frequency.value = 0.3;
    lfoGain.gain.value = 300;
    lfo.connect(lfoGain).connect(lpf.frequency);
    lfo.start();
    
    noise.connect(lpf).connect(hpf).connect(this.masterGain);
    noise.start();
    this.activeNodes.push(noise, lfo);
    
    this.isPlaying = true;
    this.currentSound = 'stream';
    this.fadeIn(0.5);
  }

  playSynthPad() {
    this.init();
    
    const notes = [110, 138.59, 164.81, 220]; // A2, C#3, E3, A3
    
    notes.forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.value = 0.08;
      
      // Gentle detune for width
      osc.detune.value = (i - 1.5) * 8;
      
      osc.connect(gain).connect(this.masterGain);
      osc.start();
      this.activeNodes.push(osc);
    });
    
    this.isPlaying = true;
    this.currentSound = 'synth';
    this.fadeIn(0.4);
  }

  playDeepDrone() {
    this.init();
    
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain1 = this.ctx.createGain();
    const gain2 = this.ctx.createGain();
    
    osc1.type = 'sine';
    osc1.frequency.value = 55; // Low A
    gain1.gain.value = 0.15;
    
    osc2.type = 'sine';
    osc2.frequency.value = 82.41; // Low E
    gain2.gain.value = 0.1;
    
    // Slow frequency wobble
    const lfo = this.ctx.createOscillator();
    const lfoG = this.ctx.createGain();
    lfo.frequency.value = 0.05;
    lfoG.gain.value = 2;
    lfo.connect(lfoG).connect(osc1.frequency);
    lfo.start();
    
    osc1.connect(gain1).connect(this.masterGain);
    osc2.connect(gain2).connect(this.masterGain);
    osc1.start();
    osc2.start();
    this.activeNodes.push(osc1, osc2, lfo);
    
    this.isPlaying = true;
    this.currentSound = 'drone';
    this.fadeIn(0.4);
  }

  playBinaural() {
    this.init();
    
    // Binaural beat for REM-like state (4-8 Hz difference)
    const oscL = this.ctx.createOscillator();
    const oscR = this.ctx.createOscillator();
    const gainL = this.ctx.createGain();
    const gainR = this.ctx.createGain();
    const merger = this.ctx.createChannelMerger(2);
    
    oscL.type = 'sine';
    oscR.type = 'sine';
    oscL.frequency.value = 200;
    oscR.frequency.value = 206; // 6 Hz binaural beat (theta waves)
    gainL.gain.value = 0.12;
    gainR.gain.value = 0.12;
    
    oscL.connect(gainL).connect(merger, 0, 0);
    oscR.connect(gainR).connect(merger, 0, 1);
    merger.connect(this.masterGain);
    
    oscL.start();
    oscR.start();
    this.activeNodes.push(oscL, oscR);
    
    // Add gentle pad
    const pad = this.ctx.createOscillator();
    const padGain = this.ctx.createGain();
    pad.type = 'sine';
    pad.frequency.value = 100;
    padGain.gain.value = 0.06;
    pad.connect(padGain).connect(this.masterGain);
    pad.start();
    this.activeNodes.push(pad);
    
    this.isPlaying = true;
    this.currentSound = 'binaural';
    this.fadeIn(0.35);
  }

  playWind() {
    this.init();
    
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.createNoiseBuffer('pink', 4);
    noise.loop = true;
    
    const bpf = this.ctx.createBiquadFilter();
    bpf.type = 'bandpass';
    bpf.frequency.value = 400;
    bpf.Q.value = 0.3;
    
    // Wind gusts
    const lfo = this.ctx.createOscillator();
    const lfoG = this.ctx.createGain();
    lfo.frequency.value = 0.15;
    lfoG.gain.value = 300;
    lfo.connect(lfoG).connect(bpf.frequency);
    lfo.start();
    
    noise.connect(bpf).connect(this.masterGain);
    noise.start();
    this.activeNodes.push(noise, lfo);
    
    this.isPlaying = true;
    this.currentSound = 'wind';
    this.fadeIn(0.5);
  }

  // Play by name
  async play(name) {
    if (this.currentSound === name && this.isPlaying) {
      await this.stopAll();
      return;
    }
    
    if (this.isPlaying) {
      await this.stopAll(0.8);
    }
    
    const methods = {
      rain: () => this.playRain(),
      ocean: () => this.playOcean(),
      thunder: () => this.playThunder(),
      fireplace: () => this.playFireplace(),
      whitenoise: () => this.playWhiteNoise(),
      stream: () => this.playStream(),
      synth: () => this.playSynthPad(),
      drone: () => this.playDeepDrone(),
      binaural: () => this.playBinaural(),
      wind: () => this.playWind()
    };
    
    if (methods[name]) {
      methods[name]();
    }
  }
}

// Singleton
const engine = new AmbientSoundEngine();
export default engine;
