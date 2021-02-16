import Extension from "./index";
import { meta, template } from "../../index.stories";

export default meta("Nodes", "Blockquote");

const Template = template(Extension);

export const Example198 = Template.bind({});
Example198.args = {
  addon: ["Heading"],
  text: `Here is a simple example:

> # Foo
> bar
> baz`,
};

export const Example199 = Template.bind({});
Example199.args = {
  addon: ["Heading"],
  text: `The spaces after the > characters can be omitted:

># Foo
>bar
> baz`,
};

export const Example200 = Template.bind({});
Example200.args = {
  addon: ["Heading"],
  text: `The > characters can be indented 1-3 spaces:

   > # Foo
   > bar
 > baz`,
};

export const Example201 = Template.bind({});
Example201.args = {
  addon: ["Heading"],
  text: `Four spaces gives us a code block:

    > # Foo
    > bar
    > baz`,
};

export const Example202 = Template.bind({});
Example202.args = {
  addon: ["Heading"],
  text: `The Laziness clause allows us to omit the > before paragraph continuation text:

> # Foo
> bar
baz`,
};

export const Example203 = Template.bind({});
Example203.args = {
  addon: ["Heading"],
  text: `A block quote can contain some lazy and some non-lazy continuation lines:

> bar
baz
> foo`,
};
