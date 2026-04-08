import axios from 'axios';
async function inspect() {
  const url = `https://divulgacandcontas.tse.jus.br/divulga/rest/v1/candidatura/listar/2022/AL/2040602022/6/candidatos`;
  try {
    const res = await axios.get(url);
    if (res.data.candidatos && res.data.candidatos.length > 0) {
      console.log('✅ Chaves do objeto candidato:', Object.keys(res.data.candidatos[0]));
      console.log('✅ Amostra do primeiro candidato:', JSON.stringify(res.data.candidatos[0], null, 2));
    }
  } catch (err) {
    console.error(err.message);
  }
}
inspect();
