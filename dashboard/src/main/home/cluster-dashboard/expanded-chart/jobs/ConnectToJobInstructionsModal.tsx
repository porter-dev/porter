import Modal from "main/home/modals/Modal";
import React from "react";
import styled from "styled-components";

const ConnectToJobInstructionsModal: React.FC<{
  show: boolean;
  onClose: () => void;
  job: any;
}> = ({ show, job, onClose }) => {
  if (!show) {
    return null;
  }

  return (
    <Modal
      onRequestClose={() => onClose()}
      width="700px"
      height="300px"
      title="Shell Access Instructions"
    >
      To get shell access to this job run, make sure you have the Porter CLI
      installed (installation instructions&nbsp;
      <a href={"https://docs.porter.run/cli/installation"} target="_blank">
        here
      </a>
      ).
      <br />
      <br />
      Run the following line of code, and make sure to change the command to
      something your container can run:
      <Code>
        porter run {job?.metadata?.labels["meta.helm.sh/release-name"]} --
        [COMMAND]
      </Code>
      Note that this will create a copy of the most recent job run for this
      template.
    </Modal>
  );
};

export default ConnectToJobInstructionsModal;

const Code = styled.div`
  background: #181b21;
  padding: 10px 15px;
  border: 1px solid #ffffff44;
  border-radius: 5px;
  margin: 10px 0px 15px;
  color: #ffffff;
  font-size: 13px;
  user-select: text;
  line-height: 1em;
  font-family: monospace;
`;
