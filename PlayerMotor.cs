using UnityEngine;

[RequireComponent(typeof(CharacterController))]
public class PlayerMotor : MonoBehaviour
{
    public float moveSpeed = 6f;
    public float accel = 14f;
    public float gravity = -25f;
    public float jumpForce = 9f;
    public float crouchSpeedMult = 0.55f;
    public Transform cameraTarget;

    private CharacterController cc;
    private Vector3 velocity;
    private float currentSpeed;
    private bool isGrounded;
    public bool IsCrouching { get; private set; }

    void Awake() => cc = GetComponent<CharacterController>();

    void Update()
    {
        isGrounded = cc.isGrounded;
        if (isGrounded && velocity.y < 0) velocity.y = -2f;

        float h = Input.GetAxisRaw("Horizontal");
        float v = Input.GetAxisRaw("Vertical");
        Vector3 input = new Vector3(h, 0, v).normalized;

        Vector3 camF = Vector3.Scale(Camera.main.transform.forward, new Vector3(1,0,1)).normalized;
        Vector3 camR = Camera.main.transform.right;
        Vector3 moveDir = (camF * input.z + camR * input.x).normalized;

        float target = moveSpeed * (IsCrouching ? crouchSpeedMult : 1f) * input.magnitude;
        currentSpeed = Mathf.MoveTowards(currentSpeed, target, accel * Time.deltaTime);
        cc.Move(moveDir * currentSpeed * Time.deltaTime);

        if (moveDir.sqrMagnitude > 0.0001f)
            transform.rotation = Quaternion.Slerp(transform.rotation, Quaternion.LookRotation(moveDir), 12f * Time.deltaTime);

        if (Input.GetButtonDown("Jump") && isGrounded && !IsCrouching) velocity.y = jumpForce;

        velocity.y += gravity * Time.deltaTime;
        cc.Move(velocity * Time.deltaTime);

        if (Input.GetKeyDown(KeyCode.LeftControl))
        {
            IsCrouching = !IsCrouching;
            cc.height = IsCrouching ? 1.2f : 1.8f;
            cc.center = new Vector3(0, cc.height/2f, 0);
        }
    }
}
