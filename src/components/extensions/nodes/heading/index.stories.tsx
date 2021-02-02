import Extension from "./index";
import { meta, template } from "../../index.stories";

export default meta("Nodes", "Heading");

const Template = template(Extension);

export const Example32 = Template.bind({});
Example32.args = {
  text: `An ATX heading consists of a string of characters, parsed as inline content, between an opening sequence of 1–6 unescaped # characters and an optional closing sequence of any number of unescaped # characters. The opening sequence of # characters must be followed by a space or by the end of line. The optional closing sequence of #s must be preceded by a space and may be followed by spaces only. The opening # character may be indented 0-3 spaces. The raw contents of the heading are stripped of leading and trailing spaces before being parsed as inline content. The heading level is equal to the number of # characters in the opening sequence.

Simple headings:

# foo
## foo
### foo
#### foo
##### foo
###### foo`,
};

export const Example33 = Template.bind({});
Example33.args = {
  text: `More than six # characters is not a heading:

####### foo`,
};

export const Example34 = Template.bind({});
Example34.args = {
  text: `At least one space is required between the # characters and the heading’s contents, unless the heading is empty. Note that many implementations currently do not require the space. However, the space was required by the original ATX implementation, and it helps prevent things like the following from being parsed as headings:

#5 bolt

#hashtag`,
};

export const Example35 = Template.bind({});
Example35.args = {
  addon: ["Escape"],
  text: `This is not a heading, because the first # is escaped:

\\## foo`,
};

export const Example36 = Template.bind({});
Example36.args = {
  addon: ["Emphasis", "Escape"],
  text: `Contents are parsed as inlines:

# foo *bar* \\*baz\\*`,
};

export const Example37 = Template.bind({});
Example37.args = {
  text: `Leading and trailing whitespace is ignored in parsing inline content:

#                  foo                     `,
};

export const Example38 = Template.bind({});
Example38.args = {
  text: `One to three spaces indentation are allowed:

### foo
 ## foo
  # foo`,
};

export const Example39 = Template.bind({});
Example39.args = {
  addon: ["Code"],
  text: `Four spaces are too much:

    # foo`,
};

export const Example40 = Template.bind({});
Example40.args = {
  addon: ["Code"],
  text: `Four spaces are too much:

foo
    # bar`,
};

export const Example41 = Template.bind({});
Example41.args = {
  text: `A closing sequence of # characters is optional:

## foo ##
  ###   bar    ###`,
};

export const Example42 = Template.bind({});
Example42.args = {
  text: `It need not be the same length as the opening sequence:

# foo ##################################
##### foo ##`,
};

export const Example43 = Template.bind({});
Example43.args = {
  text: `Spaces are allowed after the closing sequence:

### foo ###     `,
};

export const Example44 = Template.bind({});
Example44.args = {
  text: `A sequence of # characters with anything but spaces following it is not a closing sequence, but counts as part of the contents of the heading:

### foo ### b`,
};

export const Example45 = Template.bind({});
Example45.args = {
  text: `The closing sequence must be preceded by a space:

# foo#`,
};

export const Example46 = Template.bind({});
Example46.args = {
  addon: ["Escape"],
  text: `Backslash-escaped # characters do not count as part of the closing sequence:

### foo \\###
## foo #\\##
# foo \\#`,
};

export const Example47 = Template.bind({});
Example47.args = {
  addon: ["HorizontalRule"],
  text: `ATX headings need not be separated from surrounding content by blank lines, and they can interrupt paragraphs:

****
## foo
****`,
};

export const Example48 = Template.bind({});
Example48.args = {
  text: `ATX headings need not be separated from surrounding content by blank lines, and they can interrupt paragraphs:

Foo bar
# baz
Bar foo`,
};

export const Example49 = Template.bind({});
Example49.args = {
  text: `ATX headings can be empty:

## 
#
### ###`,
};
