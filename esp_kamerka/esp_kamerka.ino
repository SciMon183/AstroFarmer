#include <WiFi.h>
#include "esp_camera.h"
#include <ESP32_FTPClient.h>
#include <EEPROM.h>
#include <HTTPClient.h>

#define EEPROM_SIZE 8      // 8 bajtów = zapas na uint64_t
#define COUNTER_ADDR 0     // adres licznika w EEPROM

// --- ustawienia WiFi ---
const char* ssid = "TechnoZone";
const char* password = "TECHNOzone2420!";


uint64_t photoCounter = 0; // bardzo duży licznik
// --- ustawienia FTP ---
char ftp_server[] = "10.0.20.254";
char ftp_user[]   = "roslinki-ftp";
char ftp_pass[]   = "kamil_to_debil";
char ftp_path[] = "/home/roslinki-ftp";  // folder zdalny
const char* serverUrl = "http://10.0.20.254:8000/upload-picture";

// --- statyczny adres dla ESP32 ---
IPAddress local_IP(192,168,61,15);     // adres ESP32
IPAddress gateway(192,168,61,17);        // brama domyślna
IPAddress subnet(255,255,255,0);       // maska

// --- konfiguracja kamery ---
// musisz ustawić piny zgodnie z Twoim modułem ESP32-S3 AI CAM
camera_config_t config = {
  .pin_pwdn       = -1,
  .pin_reset      = -1,
  .pin_xclk       = 5,
  .pin_sscb_sda   = 8,
  .pin_sscb_scl   = 9,
  .pin_d7         = 4,
  .pin_d6         = 6,
  .pin_d5         = 7,
  .pin_d4         = 14,
  .pin_d3         = 17,
  .pin_d2         = 21,
  .pin_d1         = 18,
  .pin_d0         = 16,
  .pin_vsync      = 1,
  .pin_href       = 2,
  .pin_pclk       = 15,

  .xclk_freq_hz   = 20000000,
  .pixel_format   = PIXFORMAT_JPEG,
  
  // rozmiar ramki – dostosuj w zależności co chcesz
  .frame_size     = FRAMESIZE_VGA,
  .jpeg_quality   = 10,
  .fb_count       = 1,
  .grab_mode      = CAMERA_GRAB_LATEST
};

ESP32_FTPClient ftp(ftp_server, ftp_user, ftp_pass, 5000, 2);

void sendFileNameToAPI(const char* filename) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("Brak WiFi — nie wysyłam.");
    return;
  }

  HTTPClient http;
  http.begin(serverUrl);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("accept", "application/json");

  // Budujemy JSON
  String json = "{\"file_name\":\"";
  json += filename;
  json += "\"}";

  Serial.println("JSON wysyłany do API:");
  Serial.println(json);

  int code = http.POST(json);
  Serial.print("Kod odpowiedzi: ");
  Serial.println(code);

  if (code > 0) {
    Serial.println("Odpowiedź serwera:");
    Serial.println(http.getString());
  }

  http.end();
}


void setup() {
  EEPROM.begin(EEPROM_SIZE);
  EEPROM.get(COUNTER_ADDR, photoCounter);
    if (photoCounter == 0 || photoCounter == 0xFFFFFFFFFFFFFFFF) {
    photoCounter = 1;
    EEPROM.put(COUNTER_ADDR, photoCounter);
    EEPROM.commit();
  }
  Serial.begin(115200);
    Serial.print("Licznik zdjęć startuje od: ");
  Serial.println((uint64_t)photoCounter);

  // Połączenie WiFi
  Serial.println("Konfiguruję statyczne IP...");
  
  if (!WiFi.config(local_IP, gateway, subnet)) {
    Serial.println("Błąd konfiguracji statycznego IP!");
  }
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println();
  Serial.println("Połączono z WiFi!");

  // Inicjalizacja kamery
  esp_err_t err = esp_camera_init(&config);
  if (err != ESP_OK) {
    Serial.printf("Błąd inicjalizacji kamery: 0x%x\n", err);
    while (1);
  }

}

void loop() {
  // robimy zdjęcie
  camera_fb_t * fb = esp_camera_fb_get();
  if (!fb) {
    Serial.println("Nie udało się zrobić zdjęcia");
    delay(1000);
    return;
  }

  // Połącz z FTP
  ftp.OpenConnection();
  ftp.InitFile("Type I");  // binary
  ftp.ChangeWorkDir(ftp_path);

  // utwórz nazwę pliku, np. zdjęcie z timestampem
  char filename[32];
  sprintf(filename, "IMG_%010llu.jpg", photoCounter);

  

  ftp.NewFile(filename);
  ftp.WriteData(fb->buf, fb->len);
  ftp.CloseFile();
  ftp.CloseConnection();

  Serial.printf("Wysłano obraz: %s, rozmiar: %u bytes\n", filename, fb->len);
  sendFileNameToAPI(filename);
  // zwróć bufor
  esp_camera_fb_return(fb);
  
  photoCounter++;
  EEPROM.put(COUNTER_ADDR, photoCounter);
  EEPROM.commit();

  // poczekaj 1 sekundę
  delay(300000);
}
