#!/usr/bin/env bash
# Instala o serviço do OpenTrackpad para o seu usuário (sem sudo).
#
#   desktop/instalar.sh            compila, copia para ~/.local/bin/otpd e instala o serviço
#   desktop/instalar.sh --ativar   o mesmo, e já liga o serviço (e no login)
#   desktop/instalar.sh --remover  desliga e apaga o serviço e o binário
#
# Precisa de: Rust (cargo), GStreamer (para espelhar a tela) e pactl/wpctl (som).
# O celular: instale entregas/opentrackpad.apk e abra http://127.0.0.1:47802 para parear.
set -euo pipefail
aqui="$(cd "$(dirname "$0")" && pwd)"
bin="$HOME/.local/bin/otpd"
unidade="$HOME/.config/systemd/user/opentrackpad3.service"

if [[ "${1:-}" == "--remover" ]]; then
  systemctl --user disable --now opentrackpad3.service 2>/dev/null || true
  rm -f "$unidade" "$bin"
  systemctl --user daemon-reload
  echo "OpenTrackpad removido (os aparelhos de confiança continuam em ~/.config/opentrackpad)."
  exit 0
fi

echo "Compilando…"
(cd "$aqui" && cargo build --release -q)
install -Dm755 "$aqui/target/release/otpd" "$bin"
install -Dm644 "$aqui/opentrackpad3.service" "$unidade"
systemctl --user daemon-reload

if ! [[ -w /dev/uinput ]]; then
  echo
  echo "Atenção: seu usuário não pode criar o touchpad virtual (/dev/uinput)."
  echo "Rode uma vez (pede senha):"
  echo "  sudo cp $aqui/60-opentrackpad-uinput.rules /etc/udev/rules.d/ && sudo udevadm control --reload-rules && sudo udevadm trigger --name-match=uinput"
fi

if systemctl --user is-active -q opentrackpad.service 2>/dev/null; then
  echo
  echo "A versão antiga (v0.2) está rodando. Para desligá-la:"
  echo "  systemctl --user disable --now opentrackpad.service opentrackpad-tray.service opentrackpad-usb.service"
fi

if [[ "${1:-}" == "--ativar" ]]; then
  systemctl --user enable --now opentrackpad3.service
  echo "Serviço ligado. Para parear: http://127.0.0.1:47802"
else
  echo "Instalado em $bin. Para ligar agora e no login: systemctl --user enable --now opentrackpad3.service"
fi
