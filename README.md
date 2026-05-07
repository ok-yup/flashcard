# FlashLearn
  https://sourcemayongnet.github.io/flashcard/
  
แอปบัตรคำศัพท์ที่ใช้ Google Form + Google Sheet เป็น backend
ไม่ต้องมี server ไม่ต้องสมัครสมาชิก เปิด browser ใช้ได้เลย

## วิธีใช้งาน

1. สร้าง Google Form ที่มีช่องกรอก 2 ช่อง — คำศัพท์ และ ความหมาย
2. เชื่อม Form กับ Google Sheet (Google Form ทำให้อัตโนมัติ)
3. แชร์ Sheet เป็น "Anyone with the link can view"
4. เปิดแอป วาง URL ของ Form และ Sheet แล้วกด "เริ่มใช้งาน"

## Features

- Flip card — แตะการ์ดเพื่อดูความหมาย
- สุ่มคำศัพท์อัตโนมัติทุกรอบ
- Dark / Light mode
- จำ URL ที่เคยใส่ไว้ ไม่ต้องกรอกใหม่ทุกครั้ง
- จดคำศัพท์ผ่าน Google Form ได้เลยในแอป

## ข้อจำกัด

- Google Sheet ต้องแชร์เป็น public จึงจะโหลดข้อมูลได้
- ข้อมูลอยู่ใน Google Sheet ของคุณเอง ไม่ได้เก็บในแอป


## Tech Stack

- HTML / CSS / JavaScript (Vanilla)
- Google Sheets CSV Export API
- Google Forms Embed
