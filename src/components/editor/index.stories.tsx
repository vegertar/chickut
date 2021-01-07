import React from "react";
import { Story, StoryContext, Meta } from "@storybook/react/types-6-0";

import Theme, { themes } from "../theme";
import Editor from "./editor";
import * as Extensions from "../extensions";

const meta: Meta<{ theme?: string }> = {
  title: "Components/Editor",
  component: Editor,
  decorators: [
    (Story: Story, { args }: StoryContext) => {
      return (
        <Theme
          theme={args.theme}
          style={{
            margin: "0 auto",
            padding: "0 20px",
          }}
        >
          <Story />
        </Theme>
      );
    },
  ],
  args: {
    theme: "light",
  },
  argTypes: {
    theme: {
      control: {
        type: "inline-radio",
        options: Object.keys(themes),
      },
    },
  },
  parameters: {
    backgrounds: { default: "light" },
  },
};

type Props<T extends React.FC<any>> = T extends React.FC<infer P> ? P : never;

const Template: Story<Props<typeof Editor>> = (args) => (
  <Editor {...args}>
    {Object.entries(Extensions).map(([name, Render]) => (
      <Render key={name} />
    ))}
  </Editor>
);

export const Markdown = Template.bind({});
Markdown.args = {
  text: `---
__Advertisement :)__

- __[pica](https://nodeca.github.io/pica/demo/)__ - high quality and fast image
  resize in browser.
- __[babelfish](https://github.com/nodeca/babelfish/)__ - developer friendly
  i18n with plurals support and easy syntax.

You will like those projects!

---

# h1 Heading 8-)
## h2 Heading
### h3 Heading
#### h4 Heading
##### h5 Heading
###### h6 Heading


## Horizontal Rules

___

---

***


## Typographic replacements

Enable typographer option to see result.

(c) (C) (r) (R) (tm) (TM) (p) (P) +-

test.. test... test..... test?..... test!....

!!!!!! ???? ,,  -- ---

"Smartypants, double quotes" and 'single quotes'


## Emphasis

**This is bold text**

__This is bold text__

*This is italic text*

_This is italic text_

~~Strikethrough~~


## Blockquotes


> Blockquotes can also be nested...
>> ...by using additional greater-than signs right next to each other...
> > > ...or with spaces between arrows.


## Lists

Unordered

+ Create a list by starting a line with \`+\`, \`-\`, or \`*\`
+ Sub-lists are made by indenting 2 spaces:
  - Marker character change forces new list start:
    * Ac tristique libero volutpat at
    + Facilisis in pretium nisl aliquet
    - Nulla volutpat aliquam velit
+ Very easy!

Ordered

1. Lorem ipsum dolor sit amet
2. Consectetur adipiscing elit
3. Integer molestie lorem at massa


1. You can use sequential numbers...
1. ...or keep all the numbers as \`1.\`

Start numbering with offset:

57. foo
1. bar


## Code

Inline \`code\`

Indented code

    // Some comments
    line 1 of code
    line 2 of code
    line 3 of code


Block code "fences"

\`\`\`
Sample text here...
\`\`\`

Syntax highlighting

\`\`\` js
var foo = function (bar) {
  return bar++;
};

console.log(foo(5));
\`\`\`

## Tables

| Option | Description |
| ------ | ----------- |
| data   | path to data files to supply the data that will be passed into templates. |
| engine | engine to be used for processing templates. Handlebars is the default. |
| ext    | extension to be used for dest files. |

Right aligned columns

| Option | Description |
| ------:| -----------:|
| data   | path to data files to supply the data that will be passed into templates. |
| engine | engine to be used for processing templates. Handlebars is the default. |
| ext    | extension to be used for dest files. |


## Links

[link text](http://dev.nodeca.com)

[link with title](http://nodeca.github.io/pica/demo/ "title text!")

Autoconverted link https://github.com/nodeca/pica (enable linkify to see)


## Images

![Minion](https://octodex.github.com/images/minion.png)
![Stormtroopocat](https://octodex.github.com/images/stormtroopocat.jpg "The Stormtroopocat")

Like links, Images also have a footnote style syntax

![Alt text][id]

With a reference later in the document defining the URL location:

[id]: https://octodex.github.com/images/dojocat.jpg  "The Dojocat"


## Plugins

The killer feature of \`markdown-it\` is very effective support of
[syntax plugins](https://www.npmjs.org/browse/keyword/markdown-it-plugin).


### [Emojies](https://github.com/markdown-it/markdown-it-emoji)

> Classic markup: :wink: :crush: :cry: :tear: :laughing: :yum:
>
> Shortcuts (emoticons): :-) :-( 8-) ;)

see [how to change output](https://github.com/markdown-it/markdown-it-emoji#change-output) with twemoji.


### [Subscript](https://github.com/markdown-it/markdown-it-sub) / [Superscript](https://github.com/markdown-it/markdown-it-sup)

- 19^th^
- H~2~O


### [<ins>](https://github.com/markdown-it/markdown-it-ins)

++Inserted text++


### [<mark>](https://github.com/markdown-it/markdown-it-mark)

==Marked text==


### [Footnotes](https://github.com/markdown-it/markdown-it-footnote)

Footnote 1 link[^first].

Footnote 2 link[^second].

Inline footnote^[Text of inline footnote] definition.

Duplicated footnote reference[^second].

[^first]: Footnote **can have markup**

    and multiple paragraphs.

[^second]: Footnote text.


### [Definition lists](https://github.com/markdown-it/markdown-it-deflist)

Term 1

:   Definition 1
with lazy continuation.

Term 2 with *inline markup*

:   Definition 2

        { some code, part of Definition 2 }

    Third paragraph of definition 2.

_Compact style:_

Term 1
  ~ Definition 1

Term 2
  ~ Definition 2a
  ~ Definition 2b


### [Abbreviations](https://github.com/markdown-it/markdown-it-abbr)

This is HTML abbreviation example.

It converts "HTML", but keep intact partial entries like "xxxHTMLyyy" and so on.

*[HTML]: Hyper Text Markup Language

### [Custom containers](https://github.com/markdown-it/markdown-it-container)

::: warning
*here be dragons*
:::
`,
};

export const Observable = Template.bind({});
Observable.args = {
  text: `y = 100

x = {
  var y = 0;
  setInterval(() => ++y, 1000);
  return y;
}

# Demo

Try editing this code to learn how Observable works!

Observable notebooks consist of [JavaScript cells](/@observablehq/introduction-to-code). You can view the code for any cell by clicking in the left margin, or by clicking **Edit** in the cell menu <svg width="8" height="14" viewBox="0 0 8 14" fill="currentColor"><circle r="1.5" cx="4" cy="2"></circle><circle r="1.5" cx="4" cy="7"></circle><circle r="1.5" cx="4" cy="12"></circle></svg>. (The cells below are pinned <svg width="10" height="16" viewBox="4 -1 10 16" fill="currentColor"><path d="M8 1h3v1l-1 1v4l2 .875V9H9v5.125L8 15l-1-.875V9H4V7.875L6 7V3L5 2V1z"></path></svg> open, so their source is already visible.) After editing, hit Shift-Enter or click the cell’s play button <svg width="16" height="16" class="db bump" stroke-linejoin="round" fill="currentColor"><path d="M11.7206 6.94335C12.2406 7.34365 12.2406 8.12786 11.7206 8.52816L5.60999 13.2321C4.95242 13.7383 4 13.2696 4 12.4397L4 3.03178C4 2.20194 4.95243 1.73318 5.60999 2.23937L11.7206 6.94335Z" stroke="currentColor" stroke-width="1.6"></path></svg> to run the code.

1 + 1 // Edit me!

For more complex definitions such as loops, hug your code with curly braces \`{…}\`. Whatever value you return is shown.

{
  let sum = 0;
  for (let i = 0, x; i < 100; ++i) {
    sum += i;
  }
  return sum;
}

A cell can have a name, allowing its value to be referenced by other cells. A referencing cell is [run automatically](/@observablehq/how-observable-runs) when the referenced value changes.

color = "red" // Edit me!

My favorite color is $color.

You can inspect nested values such as objects and arrays by clicking on them, just like in your browser’s developer console.

object = ({open: [atob("c2VzYW1l")]})

Cells can [generate DOM elements](/@observablehq/introduction-to-html), such as HTML, SVG, Canvas and WebGL. You can use the DOM API, or our HTML and Markdown template literals.

<span style="background:yellow;">
  My favorite language is <i>HTML</i>.
</span>

Hi Mom! It’s me, *Markdown*.

DOM can be made reactive simply by referring to other cells. The next cell refers to *color*, and will update if you change the definition of *color* above.

My favorite color is <i style="background:$color;">$color</i>.

You can [load data](/@observablehq/introduction-to-data) by [attaching files](/@observablehq/file-attachments) or using the Fetch API.

cars = fetch("https://raw.githubusercontent.com/vega/vega/v4.3.0/docs/data/cars.json")
  .then(response => response.json())

You can [load libraries](/@tmcw/introduction-to-require) from npm.

d3 = require("d3-array@2")

If a cell’s value is a [promise](/@observablehq/introduction-to-promises), any referencing cell implicitly awaits it. Both \`fetch\` and \`require\` return promises, but the cell below can refer simply to their eventual values. (You can explicitly \`await\`, too.)

d3.median(cars, d => d.Horsepower)

Define a function cell to reuse code.

function greet(subject) {
  return \`Hello, \${subject}!\`;
}

greet("world")

Cells can be [generators](https://developer.mozilla.org/docs/Web/JavaScript/Guide/Iterators_and_Generators#Generators), yielding values up to sixty times a second. A cell that refers to a generator cell runs automatically whenever the generator yields a new value.

c = {
  for (let i = 0; true; ++i) {
    yield i;
  }
}

Currently, *c* = \${c}.

You can yield DOM elements for animation. Click the play button <svg width="16" height="16" class="db bump" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" fill="none"><path d="M4 3L12 8L4 13Z"></path></svg> in the top-right corner of the cell below to restart the animation.

{
  const height = 33;
  const context = DOM.context2d(width, height);
  for (let i = 0; i < width; ++i) {
    const t = i / width;
    const r = Math.floor(255 * Math.sin(Math.PI * (t + 0 / 3)) ** 2);
    const g = Math.floor(255 * Math.sin(Math.PI * (t + 1 / 3)) ** 2);
    const b = Math.floor(255 * Math.sin(Math.PI * (t + 2 / 3)) ** 2);
    context.fillStyle = \`rgb(\${r},\${g},\${b})\`;
    context.fillRect(i, 0, 1, height);
    yield context.canvas;
  }
}

Use [asynchronous iteration](/@observablehq/introduction-to-asynchronous-iteration) to control when the cell’s value changes. The cell below ticks every second, on the second.

tick = {
  while (true) {
    const date = new Date(Math.ceil(Date.now() / 1000) * 1000);
    await Promises.when(date);
    yield date;
  }
}

Asynchronous iteration works for interaction, too. Here’s a slider and a generator that yields a promise whenever you change the slider’s value.

slider = <input type=range>

sliderValue = Generators.input(slider)

Use [views](/@observablehq/introduction-to-views) as shorthand to define interactive values. The cell below defines both a graphical user interface to control a value (another slider), and an implicit generator that exposes this value to the notebook.

viewof d = html\`<input type=range>\` // Edit me! Try type=text.

Currently, *d* = \${d}.

Reuse code by [importing cells](/@observablehq/introduction-to-imports) from other notebooks!

import {tweet} from "@mbostock/tweet"

tweet("958726175123128321")`,
};

export default meta;
