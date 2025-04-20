import express from 'express';
import fetch from 'node-fetch';
import vm from 'vm';

const app = express();
const port = process.env.PORT || 3001;

const gg_js_url = 'https://ltn.gold-usergeneratedcontent.net/gg.js';
const domain2 = 'gold-usergeneratedcontent.net';

function subdomain_from_url(url, base, dir, gg) {
  let retval = '';
  if (!base) {
    if (dir === 'webp') retval = 'w';
    else if (dir === 'avif') retval = 'a';
  }

  const r = /\/[0-9a-f]{61}([0-9a-f]{2})([0-9a-f])/;
  const m = r.exec(url);
  if (!m) return retval;

  const g = parseInt(m[2] + m[1], 16);
  if (!isNaN(g)) {
    if (base) retval = String.fromCharCode(97 + gg.m(g)) + base;
    else retval += 1 + gg.m(g);
  }

  return retval;
}

function url_from_url(url, base, dir, gg) {
  return url.replace(
    /\/\/..?\.(?:gold-usergeneratedcontent\.net|hitomi\.la)\//,
    '//' + subdomain_from_url(url, base, dir, gg) + '.' + domain2 + '/'
  );
}

function full_path_from_hash(hash, gg) {
  return gg.b + gg.s(hash) + '/' + hash;
}

function real_full_path_from_hash(hash) {
  return hash.replace(/^.*(..)(.)$/, '$2/$1/' + hash);
}

function url_from_hash(galleryid, image, dir, ext, gg) {
  ext = ext || dir || image.name.split('.').pop();
  dir = dir === 'webp' || dir === 'avif' ? '' : dir + '/';
  return (
    'https://a.' +
    domain2 +
    '/' +
    dir +
    full_path_from_hash(image.hash, gg) +
    '.' +
    ext
  );
}

function url_from_url_from_hash(galleryid, image, dir, ext, base, gg) {
  if (base === 'tn') {
    return url_from_url(
      'https://a.' +
        domain2 +
        '/' +
        dir +
        '/' +
        real_full_path_from_hash(image.hash) +
        '.' +
        ext,
      base,
      dir,
      gg
    );
  }
  return url_from_url(url_from_hash(galleryid, image, dir, ext, gg), base, dir, gg);
}

async function obtenerGG(album_url) {
  const res = await fetch(gg_js_url, {
    headers: {
      accept: '*/*',
      'accept-language': 'es-419,es;q=0.9',
      referer: encodeURI(album_url),
      'user-agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0',
    },
  });
  const js = await res.text();
  const context = { gg: undefined };
  vm.createContext(context);
  vm.runInContext(js, context);
  return context.gg;
}

async function obtenerGalleryInfo(album_url, js_data_url, gg) {
  const res = await fetch(js_data_url, {
    headers: {
      accept: '*/*',
      'accept-language': 'es-419,es;q=0.9',
      referer: encodeURI(album_url),
      'user-agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0',
    },
  });

  const jsCode = await res.text();
  const context = {};
  vm.createContext(context);
  vm.runInContext(jsCode, context);

  const imageUrls = [];

  if (context.galleryinfo?.files) {
    for (const file of context.galleryinfo.files) {
      const url = url_from_url_from_hash('', file, 'webp', null, null, gg);
      imageUrls.push(url);
    }
  }

  return imageUrls;
}

app.get('/api/images', async (req, res) => {
  const album_url = req.query.url;
  if (!album_url) {
    return res.status(400).json({ error: 'Parámetro "url" requerido' });
  }

  const match = album_url.match(/-(\d+)\.html$/);
  if (!match) {
    return res.status(400).json({ error: 'URL inválida, no se encontró el ID' });
  }

  const galleryId = match[1];
  const js_data_url = `https://ltn.gold-usergeneratedcontent.net/galleries/${galleryId}.js`;

  try {
    console.log(album_url)
    const gg = await obtenerGG(album_url);
    const images = await obtenerGalleryInfo(album_url, js_data_url, gg);
    res.json({
      post_url: album_url,
      gg_js_url: gg_js_url,
      js_data_url: js_data_url,
      images: images
    });
  } catch (error) {
    console.error('❌ Error:', error);
    res.status(500).json({ error: 'Error interno al procesar la galería' });
  }
});

app.listen(port, () => {
  console.log(`✅ API corriendo en http://localhost:${port}/api/images?url=TU_URL`);
});
