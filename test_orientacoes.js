import axios from 'axios';

async function test() {
  const votacaoId = '2400758-37';
  try {
    const res = await axios.get(`https://dadosabertos.camara.leg.br/api/v2/votacoes/${votacaoId}/orientacoes`);
    console.log(JSON.stringify(res.data.dados, null, 2));
  } catch (err) {
    console.error(err.message);
  }
}
test();
