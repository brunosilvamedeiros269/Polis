import axios from 'axios';
async function test() {
  const url = `https://divulgacandcontas.tse.jus.br/divulga/rest/v1/candidato/listar/2022/BA/2040602022/14672049515/pesquisar`;
  try {
    const res = await axios.get(url);
    console.log(JSON.stringify(res.data, null, 2));
  } catch (err) {
    console.error(err.message);
  }
}
test();
