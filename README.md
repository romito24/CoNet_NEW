**מערכת CoNet - שרת API לניהול חללי עבודה וקהילות**


ברוכים הבאים לשרת ה-Backend של מערכת CoNet.
המערכת משמשת לניהול והזמנת חללי עבודה משותפים, ניהול קהילות ואירועים.

# **טכנולוגיות**

סביבת ריצה: Node.js

פריימוורק: Express

בסיס נתונים: MySQL

אימות ואבטחה: JWT & bcrypt

שירות מיילים: Nodemailer

# **הוראות התקנה**

**1. שכפול המאגר**

הריצו את הפקודות הבאות בטרמינל כדי להוריד את הפרויקט ולהתקין את הספריות הדרושות:

git clone <REPOSITORY_URL>
cd conet-backend
npm install


**2. הגדרת קובץ סביבה (.env)**

צרו קובץ בשם .env בתיקייה הראשית של הפרויקט.
העתיקו לתוכו את התוכן הבא (יש לשנות את הערכים לפרטים האמיתיים שלכם):

PORT=3000

הגדרות בסיס נתונים
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=CoNet_DB

אבטחה (מפתח חתימה לטוקנים)
JWT_SECRET=your_super_secret_key

הגדרות אימייל (לשליחת זימונים)
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password


**3. הרצת השרת**

להרצה רגילה (פיתוח):

node app.js


להרצה בסביבת ייצור (מומלץ באמצעות PM2):

pm2 start app.js --name conet_backend


# תיעוד API

כל הבקשות לשרת צריכות להתבצע מול הכתובת: http://vmedu436.mtacloud.co.il:3000.

**1. אימות משתמשים**

קובץ: routes/auth.js

**הרשמה למערכת**

יוצר משתמש חדש, מצפין את הסיסמה ושומר בבסיס הנתונים.

נתיב: POST /api/auth/register

גוף הבקשה (JSON):

{
  "first_name": "ישראל",
  "last_name": "ישראלי",
  "email": "test@test.com",
  "password": "123456",
  "phone_number": "0501234567"
}


**התחברות**

מאמת את פרטי המשתמש ומחזיר טוקן גישה (JWT).

נתיב: POST /api/auth/login

גוף הבקשה (JSON):

{
  "email": "test@test.com",
  "password": "123456"
}


**2. ניהול הזמנות**

קובץ: routes/orders.js
דרישת אבטחה: יש לשלוח טוקן ב-Header (Authorization: Bearer token)

**יצירת הזמנה חדשה**

מבצע בדיקת זמינות, מחשב עומס בחדר, שומר את ההזמנה ושולח מייל זימון למשתמש.

נתיב: POST /api/orders/create

גוף הבקשה (JSON):

{
  "space_id": 1,
  "start_time": "2025-10-10 10:00:00",
  "end_time": "2025-10-10 12:00:00",
  "attendees_count": 3
}


**ביטול הזמנה**

מבטל הזמנה קיימת ומעדכן את זמינות החדר.

נתיב: PATCH /api/orders/:orderId/cancel

**היסטוריית הזמנות**

מחזיר את כל ההזמנות של המשתמש המחובר.

נתיב: GET /api/orders/my-orders

**3. מרחבים וחיפוש** 

קובץ: routes/spaces.js

**חיפוש מרחבים פנויים**

מחזיר רשימה של מרחבים פנויים שעונים על דרישות הפיצ'רים (כגון: מכונת קפה, מקרן).

נתיב: POST /api/spaces/search

גוף הבקשה (JSON):

{
  "required_facilities": [1, 2]
}


**קבלת רשימת פיצ'רים**

מחזיר את כל הפיצ'רים הקיימים במערכת (לצורך סינון בצד הלקוח).

נתיב: GET /api/spaces/facilities


**4.קהילות (Communities)**

קובץ: routes/communities.js
דרישת אבטחה: מותר למנהלי קהילה בלבד
קיימת בדיקת כפילויות לשם הקהילה

**יצירת קהילה חדשה**

נתיב: POST /api/communities

גוף הבקשה (JSON):

{
  "user_id": 1,
  "community_name": "Developers IL",
  "main_subject": "Tech"
}


# מבנה הפרויקט
●	app.js - נקודת הכניסה לשרת, מגדיר את כל הנתיבים.

●	db.js - הגדרות חיבור לבסיס הנתונים (Connection Pool).

●	middleware/verifyToken.js - מנגנון אימות JWT שמגן על נתיבים פרטיים.

●	routes/ - מכיל את הלוגיקה של כל מודול בנפרד.



