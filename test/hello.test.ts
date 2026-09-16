import { expect, test } from 'vite-plus/test';
import { Hello } from '../src';

test('hello', () => {
  expect(new Hello().sayHello()).toBe('hello, world!');
});
