class QueueNode {
  constructor(value) {
    this.value = value;
    this.next = null;
  }
}

export class Queue {
  #head = null;
  #tail = null;
  #length = 0;

  enqueue(value) {
    const node = new QueueNode(value);
    if (this.#tail === null) {
      this.#head = node;
    } else {
      this.#tail.next = node;
    }
    this.#tail = node;
    this.#length += 1;
  }

  dequeue() {
    if (this.#head === null) {
      return undefined;
    }

    const value = this.#head.value;
    this.#head = this.#head.next;
    this.#length -= 1;
    if (this.#head === null) {
      this.#tail = null;
    }
    return value;
  }

  peek() {
    return this.#head?.value;
  }

  size() {
    return this.#length;
  }
}
