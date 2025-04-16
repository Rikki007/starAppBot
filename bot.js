require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const bot = new Telegraf(process.env.TELEGRAM_TOKEN);

// Файл для хранения file_id
const FILE_ID_STORAGE = './telegram_file_ids.json';

// Загрузка сохраненных file_id
let fileIds = {};
try {
  fileIds = require(FILE_ID_STORAGE);
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
      const horoscope = await generateMistralHoroscope(signName);
      
      // Формируем общую подпись
      const caption = `*${getZodiacEmoji(signId)} ${signName}*\n\n${horoscope}\n\n☄️Luory`;
        
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
      await ctx.reply(`Гороскоп для ${signName} успешно опубликован в канале!`);
      
    } catch (error) {
      console.error('Ошибка:', error);
      ctx.reply('Произошла ошибка при генерации гороскопа. Попробуйте позже.');
    }
});

// Генерация через API
async function generateMistralHoroscope(sign) {
  // Получаем текущую дату
  const today = new Date();
  const formattedDate = today.toLocaleDateString("ru-RU", {
      month: "long",   // Месяц
      day: "numeric"   // День
  });

  // Формируем запрос с указанием даты
  const prompt = `Напиши креативный гороскоп для ${sign} на ${formattedDate}. 
  Используй 2-3 предложения, эмодзи и позитивный тон. 
  Добавь совет на день.`;

  try {
      const response = await axios.post(
          'https://api.mistral.ai/v1/chat/completions',
          {
              model: "mistral-tiny",
              messages: [{ role: "user", content: prompt }],
              temperature: 0.7,
              max_tokens: 500,
          },
          {
              headers: {
                  'Authorization': `Bearer ${process.env.MISTRAL_API_KEY}`,
                  'Content-Type': 'application/json'
              }
          }
      );
      
      return response.data.choices[0].message.content;
  } catch (error) {
      console.error('Mistral API Error:', error.response?.data || error.message);
      throw new Error('Ошибка генерации гороскопа');
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