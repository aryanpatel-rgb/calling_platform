import express from 'express';

const app = express();

app.get('/', (req, res) => {
  res.send('Testing server is running!');
});

app.listen(3000, () => {
  console.log('Testing server running on port 3000');
});