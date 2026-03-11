import https from 'https';

https.get('https://portal.gupy.io/api/v1/jobs?limit=20&offset=0&workplaceType=remote', (res) => {
  console.log('statusCode:', res.statusCode);
  console.log('headers:', res.headers);
  let data = '';
  res.on('data', (d) => {
    data += d;
  });
  res.on('end', () => {
    console.log('body:', data.substring(0, 500));
  });
}).on('error', (e) => {
  console.error(e);
});
