#!/usr/bin/env bash
# Generates every calm sound in assets/sounds/ from nothing but ffmpeg:
# filtered noise, tones and timed events. No recordings, so no licences to
# track and nothing to pay for. Deterministic — the same seeds give the same
# files — so this script is the source and the .m4a files are its output.
#
#   cd mobile && bash scripts/generate-sounds.sh [name ...]
#
# Each sound renders L+F seconds and the last F are crossfaded into the first,
# so the file loops without a seam. Anything periodic in a recipe (waves,
# thunder swells, bowl strikes) has a period that divides L, so the crossfade
# joins two moments in the same phase. Levels are matched to -24 LUFS so
# switching sounds never jumps in volume.
#
# Note: ffmpeg's bandpass reads w as a Q factor by default; every band here
# is given in Hz, hence width_type=h throughout.
#
# Café and Morning Birds need real recordings (voices and birdsong don't
# synthesise convincingly) and are not made here.

set -euo pipefail

OUT="$(cd "$(dirname "$0")/.." && pwd)/assets/sounds"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
mkdir -p "$OUT"

F=3            # crossfade seconds
RATE=44100
TARGET=-24     # LUFS
BITRATE=64k

# ---------------------------------------------------------------------------
# Building blocks. Each prints a filter chain ending in [label]; T (render
# length) is set per sound before they are called.

noise() { # label colour seed amplitude chain
  echo "anoisesrc=c=$2:r=$RATE:a=$4:d=$T:s=$3,$5[$1]"
}

rain() { # label seed gain lowpass
  noise "$1" pink "$2" 0.5 "highpass=f=400,lowpass=f=$4,volume=$3"
}

drops() { # label probability centre width gain — sparse droplets / ticks
  echo "aevalsrc='if(lt(random(0),$2),random(1)*2-1,0)':s=$RATE:d=$T,bandpass=f=$3:width_type=h:w=$4,aecho=0.8:0.6:20:0.3,volume=$5[$1]"
}

thunder() { # label period gain seed — a low swell once per period
  noise "$1" brown "$4" 0.9 "lowpass=f=160,lowpass=f=160,volume='$3*pow(max(0,sin(2*PI*t/$2)),10)':eval=frame"
}

waves() { # label colour lowpass period gain seed
  noise "$1" "$2" "$6" 0.6 "lowpass=f=$3,volume='$5*(0.25+0.75*pow(sin(PI*t/$4),2))':eval=frame"
}

crickets() { # label gain
  echo "aevalsrc='0.05*sin(2*PI*4600*t)*gt(sin(2*PI*30*t),0.2)*gt(sin(2*PI*t),0.1)+0.035*sin(2*PI*4150*t)*gt(sin(2*PI*27*t),0.3)*gt(sin(2*PI*0.75*t),0.2)':s=$RATE:d=$T,volume=$2[$1]"
}

crackle() { # label probability gain — embers
  echo "aevalsrc='if(lt(random(0),$2),(random(1)*2-1)*pow(random(2),2),0)':s=$RATE:d=$T,highpass=f=1200,aecho=0.8:0.5:8:0.4,volume=$3[$1]"
}

pops() { # label gain — the occasional louder snap
  echo "aevalsrc='if(lt(random(3),0.00012),random(4)*2-1,0)':s=$RATE:d=$T,bandpass=f=600:width_type=h:w=500,aecho=0.8:0.6:15|30:0.5|0.3,volume=$2[$1]"
}

tone() { # label expression chain
  echo "aevalsrc='$2':s=$RATE:d=$T,$3[$1]"
}

mix() { # labels... → [out]
  local ins="" n=0
  for l in "$@"; do ins="$ins[$l]"; n=$((n + 1)); done
  echo "${ins}amix=inputs=$n:normalize=0[out]"
}

graph() { local IFS=';'; echo "$*"; }

# ---------------------------------------------------------------------------

render() { # name loop-seconds filtergraph
  local name=$1 L=$2 fg=$3
  local raw="$TMP/$name.raw.wav" loop="$TMP/$name.loop.wav"

  ffmpeg -v error -y -filter_complex "$fg" -map "[out]" -t "$T" -ar "$RATE" -ac 1 "$raw"

  ffmpeg -v error -y -i "$raw" -filter_complex "\
[0]asplit=3[a][b][c];\
[a]atrim=0:$F,asetpts=PTS-STARTPTS,afade=t=in:d=$F[head];\
[b]atrim=$L:$T,asetpts=PTS-STARTPTS,afade=t=out:d=$F[tail];\
[head][tail]amix=inputs=2:normalize=0[xf];\
[c]atrim=$F:$L,asetpts=PTS-STARTPTS[mid];\
[xf][mid]concat=n=2:v=0:a=1[out]" -map "[out]" "$loop"

  local measured gain
  measured=$(ffmpeg -hide_banner -nostats -i "$loop" -af ebur128=framelog=quiet -f null - 2>&1 |
    awk '/Integrated loudness/{f=1} f && /I:/{print $2; exit}')
  gain=$(awk -v t="$TARGET" -v m="$measured" 'BEGIN{printf "%.2f", t-m}')

  ffmpeg -v error -y -i "$loop" -af "volume=${gain}dB,alimiter=limit=0.9:level=false" \
    -c:a aac -b:a "$BITRATE" -ar "$RATE" -ac 1 "$OUT/$name.m4a"
  printf '%-16s %3ss  %6s LUFS → %s dB\n' "$name" "$L" "$measured" "$gain"
}

sound() { # name loop-seconds — reads the recipe from recipe_<name>
  local name=$1
  L=$2
  T=$((L + F))
  render "$name" "$L" "$("recipe_${name//-/_}")"
}

# ---------------------------------------------------------------------------
# Recipes

recipe_white() { graph "$(noise n white 1 0.3 lowpass=f=14000)" "$(mix n)"; }
recipe_pink() { graph "$(noise n pink 2 0.5 anull)" "$(mix n)"; }
recipe_brown() { graph "$(noise n brown 3 0.7 anull)" "$(mix n)"; }
recipe_fan() {
  graph "$(noise n brown 4 0.6 lowpass=f=700)" \
    "$(tone h '0.02*sin(2*PI*120*t)+0.01*sin(2*PI*240*t)' anull)" \
    "[n][h]amix=inputs=2:normalize=0,tremolo=f=15:d=0.05[out]"
}

recipe_gentle_rain() { graph "$(rain r 5 1.0 7000)" "$(drops d 0.002 3500 3000 2.1)" "$(mix r d)"; }
recipe_rain_on_window() { graph "$(rain r 6 0.6 3500)" "$(drops d 0.0007 5000 2500 5.4)" "$(mix r d)"; }
recipe_rain_thunder() {
  graph "$(rain r 7 1.0 7000)" "$(drops d 0.002 3500 3000 2.1)" "$(thunder t 23 1.2 8)" "$(mix r d t)"
}

recipe_calm_ocean() { graph "$(waves w brown 900 9 1.0 9)" "$(waves f pink 3000 9 0.15 10)" "$(mix w f)"; }
recipe_gentle_waves() { graph "$(waves w pink 2200 7 0.8 11)" "[w]highpass=f=150[out]"; }
recipe_forest_stream() {
  graph "$(noise a pink 12 0.5 'bandpass=f=1800:width_type=h:w=2400,tremolo=f=7:d=0.35')" \
    "$(noise b pink 13 0.5 'bandpass=f=700:width_type=h:w=600,tremolo=f=3.5:d=0.4,volume=0.7')" \
    "$(drops c 0.003 2500 2000 1.5)" "$(mix a b c)"
}

recipe_gentle_wind() {
  graph "$(noise a brown 14 0.6 "lowpass=f=500,volume='0.3+0.7*pow(sin(PI*t/12),2)':eval=frame")" \
    "$(noise b pink 15 0.5 "bandpass=f=900:width_type=h:w=500,volume='0.15+0.35*pow(sin(PI*t/20+1),2)':eval=frame")" \
    "$(mix a b)"
}
recipe_forest() {
  graph "$(noise w brown 16 0.5 "lowpass=f=450,volume='0.25+0.5*pow(sin(PI*t/12),2)':eval=frame")" \
    "$(noise l pink 17 0.5 "highpass=f=2500,lowpass=f=8000,volume='0.05+0.15*pow(sin(PI*t/15),4)':eval=frame")" \
    "$(drops k 0.0003 4000 3000 1.2)" "$(mix w l k)"
}
recipe_night_forest() {
  graph "$(crickets c 1.0)" "$(noise w brown 18 0.5 'lowpass=f=300,volume=0.3')" "$(mix c w)"
}

recipe_fireplace() {
  graph "$(noise r brown 19 0.5 'lowpass=f=350,volume=0.5')" "$(crackle c 0.0012 1.6)" "$(pops p 9.6)" "$(mix r c p)"
}
recipe_campfire() {
  graph "$(noise r brown 20 0.5 'lowpass=f=500,volume=0.35')" "$(crackle c 0.0018 1.6)" "$(pops p 8.0)" \
    "$(noise w brown 21 0.5 "lowpass=f=400,volume='0.15+0.25*pow(sin(PI*t/10),2)':eval=frame")" "$(mix r c p w)"
}
recipe_cozy_cabin() {
  graph "$(noise r brown 22 0.5 'lowpass=f=350,volume=0.35')" "$(crackle c 0.001 1.0)" \
    "$(noise m pink 23 0.5 'highpass=f=300,lowpass=f=1500,volume=0.5')" \
    "$(drops d 0.0005 1500 800 2.4)" "$(mix r c m d)"
}

recipe_library() {
  graph "$(noise a pink 24 0.5 'lowpass=f=400,volume=0.12')" "$(noise h brown 25 0.5 'lowpass=f=150,volume=0.2')" \
    "$(tone p 'if(lt(mod(t,15),0.35),(random(0)*2-1)*sin(PI*mod(t,15)/0.35),0)' 'bandpass=f=3000:width_type=h:w=3000,volume=0.08')" \
    "$(mix a h p)"
}
recipe_city_night() {
  graph "$(noise h brown 26 0.5 'lowpass=f=250,volume=0.6')" \
    "$(noise c pink 27 0.5 "bandpass=f=500:width_type=h:w=600,volume='0.5*pow(max(0,sin(PI*t/10)),6)+0.35*pow(max(0,sin(PI*t/15+0.7)),8)':eval=frame")" \
    "$(mix h c)"
}
recipe_train() {
  graph "$(noise r brown 28 0.5 'lowpass=f=180,volume=0.8')" \
    "$(noise z pink 29 0.5 'bandpass=f=1200:width_type=h:w=800,tremolo=f=9:d=0.3,volume=0.12')" \
    "$(tone k 'exp(-mod(t,1.5)*60)*(random(0)*2-1)*lt(mod(t,1.5),0.08)+exp(-(mod(t,1.5)-0.13)*60)*(random(1)*2-1)*gt(mod(t,1.5),0.13)*lt(mod(t,1.5),0.21)' 'bandpass=f=700:width_type=h:w=900,aecho=0.8:0.5:12:0.3,volume=0.9')" \
    "$(mix r z k)"
}

recipe_rainy_night() {
  graph "$(rain r 30 0.9 3500)" "$(drops d 0.0012 2500 1500 1.5)" "$(thunder t 30 0.6 31)" "$(mix r d t)"
}
recipe_ocean_at_night() { graph "$(waves w brown 600 10.5 1.0 32)" "$(crickets c 0.25)" "$(mix w c)"; }
recipe_deep_sleep() {
  graph "$(noise n brown 33 0.5 'lowpass=f=450,volume=0.8')" \
    "$(tone d '0.02*sin(2*PI*55*t)+0.012*sin(2*PI*82.5*t)' anull)" "$(mix n d)"
}

recipe_singing_bowls() {
  graph "$(tone b '0.22*exp(-mod(t,12)/3)*(1-exp(-mod(t,12)*40))*(sin(2*PI*220*t)+0.6*sin(2*PI*221.3*t)+0.4*sin(2*PI*596*t)+0.2*sin(2*PI*1150*t))+0.16*exp(-mod(t+6,12)/3)*(1-exp(-mod(t+6,12)*40))*(sin(2*PI*293.7*t)+0.6*sin(2*PI*295.1*t)+0.35*sin(2*PI*793*t))' 'aecho=0.8:0.7:120|240:0.35|0.25')" \
    "$(mix b)"
}
recipe_wind_chimes() {
  local e="" f p o
  for spec in 1046.5:5:0 1174.7:6:1.7 1318.5:7.5:3.1 1568:10:4.4 1760:12:2.3; do
    IFS=: read -r f p o <<<"$spec"
    e="$e+0.06*exp(-mod(t+$o,$p)*1.2)*(1-exp(-mod(t+$o,$p)*200))*sin(2*PI*$f*t)"
  done
  graph "$(tone c "${e#+}" 'aecho=0.8:0.6:90|170:0.3|0.2')" \
    "$(noise w brown 34 0.5 "lowpass=f=400,volume='0.1+0.15*pow(sin(PI*t/12),2)':eval=frame")" "$(mix c w)"
}
recipe_soft_drone() {
  graph "$(tone d '0.08*sin(2*PI*110*t)+0.06*sin(2*PI*110.4*t)+0.05*sin(2*PI*164.8*t)+0.04*sin(2*PI*220.6*t)' "volume='0.7+0.3*sin(2*PI*t/20)':eval=frame,lowpass=f=1200,aecho=0.8:0.6:300|500:0.3|0.2")" \
    "$(mix d)"
}

recipe_deep_space() {
  graph "$(noise n brown 35 0.5 'lowpass=f=180,volume=0.5')" \
    "$(tone d '0.05*sin(2*PI*41.2*t)*(0.6+0.4*sin(2*PI*t/30))+0.03*sin(2*PI*61.8*t)*(0.6+0.4*sin(2*PI*t/20))' anull)" \
    "$(noise s pink 36 0.5 "bandpass=f=5000:width_type=h:w=2000,volume='0.02+0.03*pow(sin(PI*t/15),2)':eval=frame")" \
    "[n][d][s]amix=inputs=3:normalize=0,aecho=0.8:0.6:700|1100:0.3|0.2[out]"
}
recipe_dreamy_ambient() {
  graph "$(tone p '0.05*(sin(2*PI*130.8*t)+sin(2*PI*131.3*t)+sin(2*PI*164.8*t)+sin(2*PI*196*t)+sin(2*PI*196.5*t)+0.7*sin(2*PI*246.9*t)+0.5*sin(2*PI*329.6*t))*(0.6+0.4*sin(2*PI*t/12))' 'lowpass=f=1500,aecho=0.8:0.6:500|750:0.4|0.3')" \
    "$(noise s pink 37 0.5 'bandpass=f=4000:width_type=h:w=2000,volume=0.02')" "$(mix p s)"
}
recipe_monsoon_rain() {
  graph "$(rain r 38 1.3 9000)" "$(noise h white 39 0.1 'highpass=f=2000,volume=0.3')" \
    "$(drops d 0.005 3000 3000 3.0)" "$(thunder t 17 1.4 40)" "$(mix r h d t)"
}

# ---------------------------------------------------------------------------
# name, loop length (s)

ALL=(
  white:30 pink:30 brown:30 fan:30
  gentle-rain:40 rain-on-window:40 rain-thunder:46
  calm-ocean:63 gentle-waves:56 forest-stream:40
  gentle-wind:60 forest:60 night-forest:60
  fireplace:40 campfire:40 cozy-cabin:40
  library:60 city-night:60 train:60
  rainy-night:60 ocean-at-night:63 deep-sleep:60
  singing-bowls:60 wind-chimes:60 soft-drone:60
  deep-space:60 dreamy-ambient:60 monsoon-rain:51
)

for entry in "${ALL[@]}"; do
  name=${entry%%:*}
  if [ $# -gt 0 ] && [[ ! " $* " == *" $name "* ]]; then continue; fi
  sound "$name" "${entry##*:}"
done
