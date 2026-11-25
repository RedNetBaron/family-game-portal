// Original category prompts for Category Dash.
export const CATEGORIES: string[] = [
  'A fruit', 'A vegetable', 'Something in a kitchen', 'A breakfast food', 'A pizza topping',
  'A sandwich ingredient', 'A dessert', 'A drink', 'A snack food', 'A spice or seasoning',
  'Something you grill', 'A food at a picnic', 'A restaurant chain', 'A candy', 'A type of soup',
  'An animal', 'A bird', 'A fish or sea creature', 'An insect or bug', 'A dog breed',
  'A farm animal', 'A zoo animal', 'A pet name', 'Something with wings', 'Something with stripes',
  'A country', 'A US state', 'A city', 'A river, lake or ocean', 'A vacation spot',
  'Something you pack for a trip', 'A type of vehicle', 'A car brand', 'Something at an airport',
  'Something at the beach', 'Something in the woods', 'A camping item', 'Something in the sky',
  'A tree or plant', 'A flower', 'A type of weather', 'Something cold', 'Something hot',
  'Something round', 'Something sticky', 'Something soft', 'Something loud', 'Something that smells good',
  'Something that smells bad', 'Something green', 'Something red', 'Something yellow',
  'Something blue', 'Something tiny', 'Something huge', 'Something you can fold',
  'Something with buttons', 'Something that bounces', 'Something that melts', 'Something you plug in',
  'A tool', 'Something in a garage', 'Something in a bathroom', 'Something in a bedroom',
  'Furniture', 'Something in a junk drawer', 'A household chore', 'Something in a toolbox',
  'Something in a purse or wallet', 'Something on a desk', 'An office supply', 'Something in a classroom',
  'A school subject', 'A job or occupation', 'Something a doctor uses', 'A store or shop',
  'A board or card game', 'A sport', 'Something used in sports', 'A sports team',
  'A hobby', 'A musical instrument', 'A song title', 'A singer or band', 'A movie title',
  'A TV show', 'A cartoon character', 'A superhero or villain', 'A famous athlete',
  'A famous person from history', 'A book title', 'A fictional character', 'A holiday',
  'Something at a birthday party', 'Something at a wedding', 'A Thanksgiving food',
  'Something you see at Christmas', 'A Halloween costume', 'A gift idea', 'A boy\'s name',
  'A girl\'s name', 'A nickname', 'A relative (aunt, cousin…)', 'Something grandparents say',
  'A reason to be late', 'An excuse for not doing homework', 'Something you shout',
  'A word that ends in -ing', 'An adjective to describe a person', 'A compliment', 'A verb',
  'A three-letter word', 'A word with double letters', 'Something you do on the weekend',
  'Something you do in the morning', 'Something that makes you laugh', 'Something scary',
  'A dance move or dance', 'Clothing', 'Something you wear on your feet', 'Something you wear on your head',
  'Jewelry or an accessory', 'A fabric', 'A hairstyle', 'Something in a first-aid kit',
  'A body part', 'An exercise', 'Something you find in a park', 'Something at a fair or carnival',
  'Something on a farm', 'Something in a city', 'Something in space', 'A planet or star',
  'A metal or mineral', 'A color', 'A shape', 'A number word', 'A unit of measurement',
  'Something with a screen', 'An app or website', 'A kind of computer or phone thing',
  'Something that runs on batteries', 'A brand name', 'Something you collect', 'Something you recycle',
  'Something you can throw', 'Something you can climb', 'Something that flies', 'Something that swims',
  'Something people are afraid of', 'Something with a lid', 'Something with a handle',
  'Something you can break', 'Something you can sharpen', 'Something in a fridge',
  'Something in a lunchbox', 'A famous landmark', 'A language', 'A college or university',
];

// Letters that work well for every category (no Q, U, V, X, Y, Z).
export const LETTERS = 'ABCDEFGHIJKLMNOPRSTW'.split('');

export function pickLetter(rand: () => number = Math.random): string {
  return LETTERS[Math.floor(rand() * LETTERS.length)];
}

export function pickCategories(count: number, rand: () => number = Math.random): string[] {
  const pool = [...CATEGORIES];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count);
}
