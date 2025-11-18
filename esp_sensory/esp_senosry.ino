#define SEN0193_PIN A0
#define SEN0308_PIN A1

#include <DFRobot_SGP40.h>
#include <DFRobot_SHT3x.h>
#include <DFRobot_EnvironmentalSensor.h>
#include <DFRobot_SCD4X.h>
#include <DFRobot_AS7341.h>
#include <DFRobot_ColorTemperature.h>
#include <WiFi.h>
#include <HTTPClient.h>

DFRobot_SGP40    mySgp40;
DFRobot_SHT3x   sht3x;
DFRobot_EnvironmentalSensor environment(SEN050X_DEFAULT_DEVICE_ADDRESS, /*pWire = */&Wire);
DFRobot_SCD4X SCD4X(&Wire, /*i2cAddr = */SCD4X_I2C_ADDR);
DFRobot_AS7341 as7341;
DFRobot_ColorTemperature CT(/*s =*/&Wire);

const char* serverUrl = "http://10.0.20.254:8000/upload";
const char* WIFI_SSID = "TwojaNazwaWiFi";
const char* WIFI_PASS = "TwojeHasloWiFi";

uint16_t airQualityIndex;
float  shtTEMP, shtHUM;
float envTEMP, envUV, envHUM, envLI;
uint16_t envPRES;
uint16_t CO2ppm; // 0~40000 ppm
uint16_t ADF1,ADF2,ADF3,ADF4,ADF5,ADF6,ADF7,ADF8,ADCLEAR,ADNIR;
uint16_t LUX,CCT; float X,Y;
uint16_t soilMoistureValue, soilMoistureValue2;

bool cz[6]={1,1,1,1,1,1};
int counter=0;

void wyslijBlad(String opisBledu);
void wyslijDane();
void sendToAPI();
void connectWiFi();

void setup() {
  Serial.begin(115200);
  
  uint16_t licznikPetli;

  licznikPetli = 0;
  while(mySgp40.begin(/*duration = */10000) !=true){
    wyslijBlad("Nie dziala SPG40");
    delay(1000);
    licznikPetli++;
    if(licznikPetli>=5) {break; cz[0]=0;}
  }
  
  licznikPetli = 0;
  while (sht3x.begin() != 0) {
    wyslijBlad("Nie dziala sht31");
    delay(1000);
    licznikPetli++;
    if(licznikPetli>=5) {break; cz[1]=0;}
  }

  licznikPetli = 0;
  while(environment.begin() != 0){
    wyslijBlad("Nie dizala czujnik srodowiskowy");
    delay(1000);
    licznikPetli++;
    if(licznikPetli>=5) {break; cz[2]=0;}
  }

  licznikPetli = 0;
  while( !SCD4X.begin() ){
    wyslijBlad("Czujnik CO2 ine dziala");
    delay(1000);
    licznikPetli++;
    if(licznikPetli>=5) {break; cz[3]=0;}
  }

  licznikPetli = 0;
  while (as7341.begin() != 0) {
    wyslijBlad("Nie dziala czujnik koloru swiatla");
    delay(1000);
    licznikPetli++;
    if(licznikPetli>=5) {break; cz[4]=0;}
  }

  licznikPetli = 0;
  while(CT.begin() != 0){
    wyslijBlad("Nie dziala ColorTemperature");
    delay(1000);
    licznikPetli++;
    if(licznikPetli>=5) {break; cz[5]=0;}
  }

  connectWiFi();
}

void loop() {
  
  if(cz[2]){
    envTEMP=environment.getTemperature(TEMP_C);
    envHUM=environment.getHumidity();
    envUV=environment.getUltravioletIntensity();
    envLI=environment.getLuminousIntensity();
    envPRES=environment.getAtmospherePressure(HPA);
  }
  
  if(cz[1]){
    shtTEMP=sht3x.getTemperatureC();
    shtHUM=sht3x.getHumidityRH();
  }

  if(cz[3]){
    if(SCD4X.getDataReadyStatus()) {
      DFRobot_SCD4X::sSensorMeasurement_t data;
      SCD4X.readMeasurement(&data);
      CO2ppm=data.CO2ppm;
    }
  }

  if(cz[4]){
    DFRobot_AS7341::sModeOneData_t data1;
    DFRobot_AS7341::sModeTwoData_t data2;
    as7341.startMeasure(as7341.eF1F4ClearNIR);
    data1 = as7341.readSpectralDataOne();
    as7341.startMeasure(as7341.eF5F8ClearNIR);
    data2 = as7341.readSpectralDataTwo();
    ADF1=data1.ADF1;
    ADF2=data1.ADF2;
    ADF3=data1.ADF3;
    ADF4=data1.ADF4;
    ADF5=data2.ADF5;
    ADF6=data2.ADF6;
    ADF7=data2.ADF7;
    ADF8=data2.ADF8;
    ADCLEAR=data2.ADCLEAR;
    ADNIR=data2.ADNIR;
  }

  if(cz[5]){
    LUX=CT.readLUX();
    CCT=CT.readCCT();
    X=CT.readX();
    Y=CT.readY();
  }

  if(cz[0]){
    if(counter>=5){
      if(cz[2]) mySgp40.setRhT(envHUM, envTEMP);
      else if(cz[1]) mySgp40.setRhT(shtTEMP, shtTEMP);
    
      delay(10);
      airQualityIndex = mySgp40.getVoclndex();
      counter=0;
    }
    else counter++;
  }

  soilMoistureValue = analogRead(SEN0193_PIN);
  soilMoistureValue2 = analogRead(SEN0308_PIN);

  wyswietlDane();

  delay(1500);

  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("Utracono WiFi — ponawiam...");
    connectWiFi();
  }

  
}

void wyslijBlad(String opisBledu){
  
  Serial.println(opisBledu);
  
}

void wyswietlDane(){
  Serial.print(airQualityIndex);
  Serial.print('\t');
  Serial.print(shtTEMP);
  Serial.print('\t');
  Serial.print(envTEMP);
  Serial.print('\t');
  Serial.print(envPRES);
  Serial.print('\t');
  Serial.print(CO2ppm);
  Serial.print('\t');
  Serial.print(ADF1);
  Serial.print('\t');
  Serial.print(LUX);
  Serial.print('\t');
  Serial.print(X);
  Serial.print('\t');
  Serial.print(soilMoistureValue);
  Serial.print('\n');
}


void sendToAPI() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("Brak WiFi — nie wysyłam.");
    return;
  }

  HTTPClient http;
  http.begin(serverUrl);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("accept", "application/json");

  String json = "{";
  json += "\"ts\":\"" + String((unsigned long)time(NULL)) + "\",";  
  json += "\"airQualityIndex\":" + String(airQualityIndex) + ",";
  json += "\"shtTEMP\":" + String(shtTEMP) + ",";
  json += "\"shtHUM\":" + String(shtHUM) + ",";
  json += "\"envTEMP\":" + String(envTEMP) + ",";
  json += "\"envUV\":" + String(envUV) + ",";
  json += "\"envHUM\":" + String(envHUM) + ",";
  json += "\"envLI\":" + String(envLI) + ",";
  json += "\"envPRES\":" + String(envPRES) + ",";
  json += "\"CO2ppm\":" + String(CO2ppm) + ",";
  json += "\"ADF1\":" + String(ADF1) + ",";
  json += "\"ADF2\":" + String(ADF2) + ",";
  json += "\"ADF3\":" + String(ADF3) + ",";
  json += "\"ADF4\":" + String(ADF4) + ",";
  json += "\"ADF5\":" + String(ADF5) + ",";
  json += "\"ADF6\":" + String(ADF6) + ",";
  json += "\"ADF7\":" + String(ADF7) + ",";
  json += "\"ADF8\":" + String(ADF8) + ",";
  json += "\"ADCLEAR\":" + String(ADCLEAR) + ",";
  json += "\"ADNIR\":" + String(ADNIR) + ",";
  json += "\"LUX\":" + String(LUX) + ",";
  json += "\"CCT\":" + String(CCT) + ",";
  json += "\"X\":" + String(X, 4) + ",";
  json += "\"Y\":" + String(Y, 4) + ",";
  json += "\"soilMoistureValue\":" + String(soilMoistureValue) + ",";
  json += "\"soilMoistureValue2\":" + String(soilMoistureValue2);
  json += "}";

  Serial.println("Wysyłam JSON:");
  Serial.println(json);

  int httpCode = http.POST(json);
  Serial.print("Kod odpowiedzi: ");
  Serial.println(httpCode);

  if (httpCode > 0) {
    Serial.println(http.getString());
  }

  http.end();
}

void connectWiFi() {
  Serial.println();
  Serial.print("Łączenie z WiFi: ");
  Serial.println(WIFI_SSID);

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASS);

  int retries = 0;
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
    retries++;

    if (retries > 40) {   // 20 sekund
      Serial.println("\nNie można połączyć z WiFi.");
      return;
    }
  }

  Serial.println("\nPołączono!");
  Serial.print("IP: ");
  Serial.println(WiFi.localIP());
}
