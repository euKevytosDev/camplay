#include <ETH.h>
#include <HTTPClient.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>

// WT32-ETH01: rede no cabo, relógio no IO0. O botão liga o IO14 no GND.
#define ETH_PHY_ADDR 1
#define ETH_PHY_POWER 16
#define ETH_PHY_MDC 23
#define ETH_PHY_MDIO 18
#define ETH_PHY_TYPE ETH_PHY_LAN8720
#define ETH_CLK_MODE ETH_CLOCK_GPIO0_IN

#define BUTTON_PIN 14
static const char *CLIP_URL = "https://cliqueplay.com.br/clip";

static bool link_up = false;

void on_event(WiFiEvent_t event) {
  switch (event) {
    case ARDUINO_EVENT_ETH_START:
      ETH.setHostname("cliqueplay-botao");
      break;
    case ARDUINO_EVENT_ETH_GOT_IP:
      link_up = true;
      Serial.print("Rede ok ");
      Serial.println(ETH.localIP());
      break;
    case ARDUINO_EVENT_ETH_DISCONNECTED:
    case ARDUINO_EVENT_ETH_STOP:
      link_up = false;
      Serial.println("Rede caiu");
      break;
    default:
      break;
  }
}

bool save_clip() {
  if (!link_up) {
    Serial.println("Cabo de rede ainda sem internet");
    return false;
  }
  WiFiClientSecure client;
  client.setInsecure();
  HTTPClient http;
  if (!http.begin(client, CLIP_URL)) {
    Serial.println("Nao abriu o site");
    return false;
  }
  int code = http.POST("");
  Serial.print("Lance ");
  Serial.println(code);
  http.end();
  return code >= 200 && code < 300;
}

void setup() {
  Serial.begin(115200);
  delay(300);
  Serial.println("CliquePlay botao");
  pinMode(BUTTON_PIN, INPUT_PULLUP);
  WiFi.onEvent(on_event);
  ETH.begin(ETH_PHY_ADDR, ETH_PHY_POWER, ETH_PHY_MDC, ETH_PHY_MDIO, ETH_PHY_TYPE, ETH_CLK_MODE);
}

void loop() {
  static bool held = false;
  bool down = digitalRead(BUTTON_PIN) == LOW;
  if (down && !held) {
    held = true;
    save_clip();
  }
  if (!down) {
    held = false;
  }
  delay(40);
}
