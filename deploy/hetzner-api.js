import axios from "axios"

const apiToken = process.env.HETZNER_API_TOKEN
const apiClient = axios.create({
  baseURL: 'https://api.hetzner.cloud/v1/',
  headers: {
    'Authorization': `Bearer ${apiToken}`,
    'Content-Type': 'application/json'
  }
})

apiClient.interceptors.request.use(request => {
  console.log(request.method + " > " + request.url)
  return request
})

async function retry(promiseFn, attempts = 20, delay = 3000) {
  const shouldRetry = (error) => {
    return error.code === 'ECONNABORTED' || (error.response && error.response.status >= 500)
  }

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await promiseFn()
    } catch (error) {
      if (!shouldRetry(error) || attempt === attempts) {
        throw error
      }
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }
}


export class Resource {
  #kind
  #kinds
  #name
  constructor(kind, name) {
    this.#kind = kind
    this.#kinds = kind + 's'
    this.#name = name
  }

  async action(name, parameters) {
    const match = await this.find()
    await apiClient.post(`/${this.#kinds}/${match.id}/actions/${name}`, parameters)
  }

  async id() {
    const match = await this.get()
    return match.id
  }

  get name() {
    return this.#name
  }

  async get() {
    const match = this.find()
    if (!match) {
      throw new Error(`Cannot get ${this.#kind} with name ${this.#name}`)
    }
    return match
  }

  async find() {
    const resources = (await apiClient.get(this.#kinds)).data[this.#kinds]
    return resources.find(resource => resource.name === this.#name)
  }

  async delete() {
    let match = await this.find()
    if (!match) {
      return
    }

    const deleteResponse = await retry(() => apiClient.delete(`${this.#kinds}/${match.id}`))
    const actionToWait = deleteResponse.data.action
    if (!actionToWait) {
      return
    }

    while (true) {
      const deletion = await apiClient.get(`/actions/${actionToWait.id}`)
      if (deletion.data.action.status === 'success') break
      if (deletion.data.action.status === 'error') throw new Error(`Error occurred while deleting ${this.#kinds} with ID ${match.id}`)
      await new Promise(resolve => setTimeout(resolve, 2500))
    }
  }

  async create(parameters) {
    const configuration = {
      name: this.#name,
      ...parameters
    }
    const creation = (await apiClient.post(this.#kinds, configuration)).data[this.#kind]
    return creation
  }

  async createIfAbsent(parameters) {
    const match = await this.find()
    if (match) {
      return match
    } else {
      return this.create(parameters)
    }
  }
}


