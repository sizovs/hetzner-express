import axios from "axios";

const apiToken = process.env.HETZNER_API_TOKEN
const apiClient = axios.create({
  baseURL: 'https://api.hetzner.cloud/v1/',
  headers: {
    'Authorization': `Bearer ${apiToken}`,
    'Content-Type': 'application/json'
  }
});

apiClient.interceptors.request.use(request => {
  console.log(request.method + " > " + request.url)
  return request
})

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

  async find() {
    const resources = (await apiClient.get(this.#kinds)).data[this.#kinds];
    return resources.find(resource => resource.name === this.#name);
  }

  async delete() {
    const match = await this.find()
    if (match) {
      await apiClient.delete(this.#kinds + '/' + match.id)
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

