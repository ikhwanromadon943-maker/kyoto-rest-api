import { safeFetch, setCORS, errRes } from './_helper.js';

export default async function handler(req, res) {
  setCORS(res);
  if (req.method === 'OPTIONS') return res.status(200).json({ status: true, message: 'CORS preflight OK' });

  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const ep = url.pathname.replace(/^\/api\/fun\/?/, '');

    if (ep === 'joke') {
      const d = await safeFetch('https://v2.jokeapi.dev/joke/Any?type=single');
      return res.json({ status: true, author: 'Kyoto API', provider: 'JokeAPI', joke: d.joke, category: d.category });
    }

    if (ep === 'dadjoke') {
      const d = await safeFetch('https://icanhazdadjoke.com/', { headers: { Accept: 'application/json' } });
      return res.json({ status: true, author: 'Kyoto API', provider: 'icanhazdadjoke', joke: d.joke });
    }

    if (ep === 'fact') {
      const d = await safeFetch('https://uselessfacts.jsph.pl/api/v2/facts/random');
      return res.json({ status: true, author: 'Kyoto API', provider: 'Useless Facts', fact: d.text });
    }

    if (ep === 'chuck-norris') {
      const d = await safeFetch('https://api.chucknorris.io/jokes/random');
      return res.json({ status: true, author: 'Kyoto API', provider: 'Chuck Norris API', joke: d.value, url: d.url });
    }

    if (ep === 'quote') {
      const d = await safeFetch('https://api.quotable.io/random');
      return res.json({ status: true, author: 'Kyoto API', provider: 'Quotable', quote: d.content, author: d.author, tags: d.tags });
    }

    if (ep === 'cat-fact') {
      const d = await safeFetch('https://catfact.ninja/fact');
      return res.json({ status: true, author: 'Kyoto API', provider: 'Cat Facts', fact: d.fact });
    }

    if (ep === 'bored') {
      const d = await safeFetch('https://bored-api.appbrewery.com/random');
      return res.json({ status: true, author: 'Kyoto API', provider: 'Bored API', activity: d.activity, type: d.type, participants: d.participants, price: d.price });
    }

    // NEW: Random joke by category
    if (ep === 'joke-category') {
      const cat = url.searchParams.get('category') || 'Programming';
      const allowed = ['Programming','Misc','Dark','Pun','Spooky','Christmas'];
      if (!allowed.includes(cat)) return errRes(res, `Invalid category. Allowed: ${allowed.join(', ')}`);
      const d = await safeFetch(`https://v2.jokeapi.dev/joke/${cat}?type=single`);
      return res.json({ status: true, author: 'Kyoto API', provider: 'JokeAPI', category: cat, joke: d.joke });
    }

    // NEW: Random quote by author tag
    if (ep === 'quote-tag') {
      const tag = url.searchParams.get('tag') || 'inspirational';
      const d = await safeFetch(`https://api.quotable.io/random?tags=${encodeURIComponent(tag)}`);
      return res.json({ status: true, author: 'Kyoto API', provider: 'Quotable', quote: d.content, author: d.author, tag });
    }

    // NEW: Random dog fact
    if (ep === 'dog-fact') {
      const d = await safeFetch('https://dogapi.dog/api/v2/facts?limit=1');
      return res.json({ status: true, author: 'Kyoto API', provider: 'Dog API', fact: d.data?.[0]?.attributes?.body || 'No fact found' });
    }

    // NEW: Random number fact
    if (ep === 'number-fact') {
      const num = url.searchParams.get('number') || Math.floor(Math.random() * 1000);
      const type = url.searchParams.get('type') || 'trivia'; // trivia, math, date, year
      const r = await fetch(`http://numbersapi.com/${num}/${type}`);
      if (!r.ok) throw new Error(`Upstream error: HTTP ${r.status}`);
      const text = await r.text();
      return res.json({ status: true, author: 'Kyoto API', provider: 'Numbers API', number: num, type, fact: text });
    }

    // NEW: Random affirmation
    if (ep === 'affirmation') {
      const d = await safeFetch('https://www.affirmations.dev/');
      return res.json({ status: true, author: 'Kyoto API', provider: 'affirmations.dev', affirmation: d.affirmation });
    }

    // NEW: Random advice
    if (ep === 'advice') {
      const d = await safeFetch('https://api.adviceslip.com/advice');
      return res.json({ status: true, author: 'Kyoto API', provider: 'Advice Slip', id: d.slip?.id, advice: d.slip?.advice });
    }

    // NEW: Random trivia question
    if (ep === 'trivia') {
      const difficulty = url.searchParams.get('difficulty') || 'medium';
      const d = await safeFetch(`https://opentdb.com/api.php?amount=1&type=multiple&difficulty=${difficulty}`);
      if (d.response_code !== 0) throw new Error('Trivia API returned no results');
      const q = d.results?.[0];
      return res.json({ status: true, author: 'Kyoto API', provider: 'Open Trivia DB', question: q.question, category: q.category, difficulty: q.difficulty, correct_answer: q.correct_answer, incorrect_answers: q.incorrect_answers });
    }

    // NEW: Random fox image
    if (ep === 'fox') {
      const d = await safeFetch('https://randomfox.ca/floof/');
      return res.json({ status: true, author: 'Kyoto API', provider: 'Random Fox', image: d.image, link: d.link });
    }

    // NEW: Random dog image
    if (ep === 'dog') {
      const d = await safeFetch('https://dog.ceo/api/breeds/image/random');
      return res.json({ status: true, author: 'Kyoto API', provider: 'Dog CEO', image: d.message });
    }

    // NEW: Random cat image
    if (ep === 'cat') {
      const d = await safeFetch('https://api.thecatapi.com/v1/images/search');
      return res.json({ status: true, author: 'Kyoto API', provider: 'The Cat API', image: d[0]?.url, id: d[0]?.id });
    }

    return errRes(res, `Endpoint /api/fun/${ep} not found`);
  } catch (err) {
    return res.status(500).json({ status: false, author: 'Kyoto API', error: err.message, hint: 'Upstream API may be rate-limited or blocked' });
  }
}
