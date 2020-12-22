import Extension from "./index";
import { meta, template } from "../../../index.stories";

export default meta("Nodes", Extension);

const Template = template(Extension);

export const First = Template.bind({});
First.args = {
  text: "# hello",
};

export const Second = Template.bind({});
Second.args = {
  text: "## hello",
};

export const Third = Template.bind({});
Third.args = {
  text: "### hello",
};

export const Fourth = Template.bind({});
Fourth.args = {
  text: "#### hello",
};

export const Fifth = Template.bind({});
Fifth.args = {
  text: "##### hello",
};

export const Sixth = Template.bind({});
Sixth.args = {
  text: "###### hello",
};
