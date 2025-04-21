import dotenv from 'dotenv';
import { Telegraf, Markup } from 'telegraf';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Buffer } from 'buffer';

// Инициализация переменных окружения
dotenv.config();

// Получение __dirname в ES-модулях
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const bot = new Telegraf(process.env.TELEGRAM_TOKEN);

// Файл для хранения file_id
const FILE_ID_STORAGE = './telegram_file_ids.json';

// Загрузка сохраненных file_id
let fileIds = {};
try {
  const data = fs.readFileSync(FILE_ID_STORAGE, 'utf8');
  fileIds = JSON.parse(data);
} catch {
  console.log('Файл с file_id не найден, начнем с пустого хранилища');
}

// Команда для загрузки изображений
bot.command('upload_images', async (ctx) => {
    const zodiacFiles = {
        aries: ['jpg', 'png'],
        taurus: ['png', 'jpg'],
        gemini: ['png', 'jpg'],
        cancer: ['png', 'jpg'],
        leo: ['png', 'jpg'],
        virgo: ['png', 'jpg'],
        libra: ['png', 'jpg'],
        scorpio: ['png', 'jpg'],
        sagittarius: ['png', 'jpg'],
        capricorn: ['png', 'jpg'],
        aquarius: ['png', 'jpg'],
        pisces: ['png', 'jpg'],
    };

    for (const [sign, extensions] of Object.entries(zodiacFiles)) {
        let uploaded = false;
        
        for (const ext of extensions) {
            const filename = `${sign}.${ext}`;
            const imagePath = path.join(__dirname, 'assets', 'zodiac', filename);
            
            if (!fs.existsSync(imagePath)) continue;

            try {
                const msg = await ctx.replyWithPhoto({ 
                    source: fs.createReadStream(imagePath)
                });
                
                fileIds[sign] = msg.photo[0].file_id;
                console.log(`Успешно загружен ${filename} для ${sign}`);
                uploaded = true;
                break;
            } catch (error) {
                console.error(`Ошибка загрузки ${filename}:`, error.message);
            }
        }
        
        if (!uploaded) {
            console.error(`Не найден файл для ${sign}`);
            await ctx.reply(`⚠️ Файл для ${sign} не найден!`);
        }
    }

    fs.writeFileSync(FILE_ID_STORAGE, JSON.stringify(fileIds, null, 2));
    return ctx.reply('Загрузка изображений завершена!');
});



// Клавиатура со знаками зодиака
const zodiacKeyboard = Markup.inlineKeyboard([
  [Markup.button.callback('♈ Овен', 'aries')],
  [Markup.button.callback('♉ Телец', 'taurus')],
  [Markup.button.callback('♊ Близнецы', 'gemini')],
  [Markup.button.callback('♋ Рак', 'cancer')],
  [Markup.button.callback('♌ Лев', 'leo')],
  [Markup.button.callback('♍ Дева', 'virgo')],
  [Markup.button.callback('♎ Весы', 'libra')],
  [Markup.button.callback('♏ Скорпион', 'scorpio')],
  [Markup.button.callback('♐ Стрелец', 'sagittarius')],
  [Markup.button.callback('♑ Козерог', 'capricorn')],
  [Markup.button.callback('♒ Водолей', 'aquarius')],
  [Markup.button.callback('♓ Рыбы', 'pisces')],
]);

// Стартовая команда с клавиатурой
bot.start((ctx) => {
  ctx.reply('Выберите знак зодиака для генерации гороскопа:', zodiacKeyboard);
});

// Обработка кнопок
bot.action(/.+/, async (ctx) => {
    try {
      const signMap = {
        aries: 'Овен', taurus: 'Телец', gemini: 'Близнецы',
        cancer: 'Рак', leo: 'Лев', virgo: 'Дева',
        libra: 'Весы', scorpio: 'Скорпион', sagittarius: 'Стрелец',
        capricorn: 'Козерог', aquarius: 'Водолей', pisces: 'Рыбы'
      };
      
      const signId = ctx.match[0];
      const signName = signMap[signId];
      
      if (!signName) {
        return ctx.reply('Неизвестный знак зодиака');
      }
  
      await ctx.replyWithChatAction('typing');
      const astroData = await getAstroData(new Date());
      const horoscope = await generateIOHoroscope(signName, astroData);
      const todayDate = getTodayDate();
      
      // Формируем общую подпись
      const caption = `*${getZodiacEmoji(signId)} ${signName}*\n\n${todayDate}.\n\n${horoscope}\n\n☄️Luory`;
        
      // Получаем правильный file_id
      const photoFileId = fileIds[signId]; // Используем signId без расширения
      
      if (photoFileId) {
          await bot.telegram.sendPhoto(
              process.env.CHANNEL_ID,
              photoFileId,
              {
                  caption: caption,
                  parse_mode: "Markdown"
              }
          );
      } else {
          console.warn(`Нет фото для ${signId}`);
          await bot.telegram.sendMessage(
              process.env.CHANNEL_ID,
              caption,
              { parse_mode: "Markdown" }
          );
      }
      
      // Уведомляем пользователя
      await ctx.reply(`Гороскоп для ${signName} опубликован в канале!`);
      
    } catch (error) {
      console.error('Ошибка:', error);
      ctx.reply('Произошла ошибка при генерации гороскопа. Попробуйте позже.');
    }
});

// получаем данные об астрономических явлениях

async function getAstroData(date) {
  try {
    // Проверка учетных данных
    if (!process.env.ASTRONOMY_APP_ID || !process.env.ASTRONOMY_APP_SECRET) {
      throw new Error('Добавьте ASTRONOMY_APP_ID и ASTRONOMY_APP_SECRET в .env');
    }

    // Форматирование времени БЕЗ ручного кодирования
    const timeStr = date.toTimeString().split(' ')[0]; // "21:20:42"

    const params = {
      latitude: 37.9838,
      longitude: 23.7275,
      elevation: 1,
      from_date: date.toISOString().split('T')[0],
      to_date: date.toISOString().split('T')[0],
      time: timeStr, // "21:20:42" → URLSearchParams сам закодирует в "21%3A20%3A42"
      output: "table"
    };

    // Формируем URLSearchParams
    const query = new URLSearchParams(params);
    const apiUrl = `https://api.astronomyapi.com/api/v2/bodies/positions?${query}`;

    // Авторизация
    const authString = Buffer.from(`${process.env.ASTRONOMY_APP_ID}:${process.env.ASTRONOMY_APP_SECRET}`).toString('base64');

    // Запрос
    const response = await axios.get(apiUrl, {
      headers: {
        'Authorization': `Basic ${authString}`,
        'Accept': 'application/json'
      }
    });

    return response.data;
  } catch (error) {
    console.error('Ошибка запроса:', {
      url: error.config?.url,
      status: error.response?.status,
      data: error.response?.data
    });
    throw new Error('API Error');
  }
}

// Генерация даты
function getTodayDate() {
  const date = new Date();
  const todayDate = date.toLocaleDateString("ru-RU", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  return todayDate;
}

// Генерация через API

async function generateIOHoroscope(sign, astroData) {

  // Извлекаем нужные данные из ответа AstronomyAPI
  const sun = astroData.data.table.rows.find(r => r.entry.name === 'Sun');
  const moon = astroData.data.table.rows.find(r => r.entry.name === 'Moon');
  const mercury = astroData.data.table.rows.find(r => r.entry.name === 'Mercury');
  const venus = astroData.data.table.rows.find(r => r.entry.name === 'Venus');
  const mars = astroData.data.table.rows.find(r => r.entry.name === 'Mars');
  const jupiter = astroData.data.table.rows.find(r => r.entry.name === 'Jupiter');
  const saturn = astroData.data.table.rows.find(r => r.entry.name === 'Saturn');
  const uranus = astroData.data.table.rows.find(r => r.entry.name === 'Uranus');
  const neptune = astroData.data.table.rows.find(r => r.entry.name === 'Neptune');
  const pluto = astroData.data.table.rows.find(r => r.entry.name === 'Pluto');
  
  // Формируем астрологические факты
  const astroFacts = [
    `Солнце в созвездии: ${sun.cells[0].position.constellation.name}`,
    `Луна в созвездии: ${moon.cells[0].position.constellation.name}`,
    `Меркурий в созвездии: ${mercury.cells[0].position.constellation.name}`,
    `Венера в созвездии: ${venus.cells[0].position.constellation.name}`,
    `Марс в созвездии: ${mars.cells[0].position.constellation.name}`,
    `Юпитер в созвездии: ${jupiter.cells[0].position.constellation.name}`,
    `Сатурн в созвездии: ${saturn.cells[0].position.constellation.name}`,
    `Уран в созвездии: ${uranus.cells[0].position.constellation.name}`,
    `Нептун в созвездии: ${neptune.cells[0].position.constellation.name}`,
    `Плутон в созвездии: ${pluto.cells[0].position.constellation.name}`,
    
  ].join('\n');

  const rulingPlanet = {
    "Овен": "Марс",
    "Телец": "Венера",
    "Близнецы": "Меркурий",
    "Рак": "Луна",
    "Лев": "Солнце",
    "Дева": "Меркурий",
    "Весы": "Венера",
    "Скорпион": "Плутон, Марс",
    "Стрелец": "Юпитер",
    "Козерог": "Сатурн",
    "Водолей": "Уран, Сатурн",
    "Рыбы": "Нептун, Юпитер"
  };
  

  const date = new Date();
  const prompt = `Составь гороскоп для ${sign} на ${date.toLocaleDateString()} в традиции западной астрологии.

  Астрологические данные:
  ${astroFacts}

  Требования:
  1. Тон: позитивный/нейтральный.
  2. Структура:
    - 3-4 предложения о ключевых тенденциях дня.
    - Практический совет (1-2 предложения) по карьере, отношениям, финансам или досугу.
  3. Учёт астрологии:
    - Если Луна, Солнце или планеты (включая Плутон) находятся в ${sign}, объясни их влияние.
    - Упомяни правящую планету знака ${sign} (${rulingPlanet}).
  4. Запрещено:
    - Профессиональный жаргон.
    - Общие фразы ("будьте осторожны", "доверяйте интуиции").
    - Советы без привязки к астрологическим данным.
    - Ответ должен быть на русском языке.

  Пример совета: "Отложите крупные покупки — Венера в оппозиции к вашему знаку может исказить финансовые приоритеты".`;

  
  try {
    const response = await axios.post(
      'https://api.intelligence.io.solutions/api/v1/chat/completions',
      {
        model: "mistralai/Ministral-8B-Instruct-2410",
        messages: [
          { 
            role: "system", 
            content: "Ты профессиональный астролог. Составь гороскоп на основе предоставленных данных."
          },
          { 
            role: "user", 
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 380
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.IO_INTELLIGENCE_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );

    return response.data.choices[0].message.content;
  } catch (error) {
    console.error('Ошибка генерации:', error.response?.data || error.message);
    throw new Error('Не удалось создать гороскоп');
  }
}

// Получение эмодзи для знака
function getZodiacEmoji(signId) {
  const emojis = {
    aries: '♈', taurus: '♉', gemini: '♊',
    cancer: '♋', leo: '♌', virgo: '♍',
    libra: '♎', scorpio: '♏', sagittarius: '♐',
    capricorn: '♑', aquarius: '♒', pisces: '♓'
  };
  return emojis[signId] || '✨';
}

// Обработка ошибок
bot.catch((err, ctx) => {
  console.error(`Ошибка для ${ctx.updateType}:`, err);
  ctx.reply('Произошла внутренняя ошибка бота');
});

// Запуск бота
bot.launch().then(() => {
  console.log('Бот запущен!');
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));