const Lights = () => {
  return (
    <>
      <ambientLight />
      <pointLight position={[10, 10, 10]} />
      {/* <Environment preset="sunset" /> */}
    </>
  );
};

export default Lights;
